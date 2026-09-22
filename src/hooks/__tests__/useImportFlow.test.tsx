import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider, useAppState } from "@/contexts/AppStateContext";
import type { ImportResult } from "@/types/forms";
import { importMetadata } from "@/utils/exportImport";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
import { useImportFlow } from "../useImportFlow";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const payload = {
  projectData: { project_id: "P1", research_project: "Imported" },
  experiments: [],
  datasets: [],
};
vi.mock("@/utils/exportImport", () => ({ importMetadata: vi.fn(async () => payload) }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>
    <AppStateProvider>{children}</AppStateProvider>
  </WorkspaceProvider>
);

function useAll() {
  return { flow: useImportFlow(), app: useAppState(), ws: useWorkspace() };
}

async function pickFile(result: { current: ReturnType<typeof useAll> }) {
  const file = new File(["{}"], "f.json", { type: "application/json" });
  await act(async () => {
    await result.current.flow.inputProps.onChange({
      target: { files: [file], value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  });
}

describe("useImportFlow", () => {
  beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
  });

  it("with no projects, imports as a new project and cannot merge", async () => {
    const { result } = renderHook(useAll, { wrapper });
    await pickFile(result);
    expect(result.current.flow.previewProps.opened).toBe(true);
    expect(result.current.flow.previewProps.canMerge).toBe(false);

    act(() => result.current.flow.previewProps.onImport());
    expect(result.current.ws.projects).toHaveLength(1);
    expect(result.current.ws.projects[0].name).toBe("Imported");
    expect(navigate).toHaveBeenCalledWith({ to: "/overview" });
    expect(result.current.flow.previewProps.opened).toBe(false);
  });

  it("with a project, merge mode imports into the current session", async () => {
    const { result } = renderHook(useAll, { wrapper });
    act(() => {
      result.current.ws.createProject();
    });
    await pickFile(result);
    expect(result.current.flow.previewProps.canMerge).toBe(true);

    act(() => result.current.flow.previewProps.onImportModeChange("merge"));
    act(() => result.current.flow.previewProps.onImport());
    expect(result.current.ws.projects).toHaveLength(1);
    expect(result.current.app.state.projectData.research_project).toBe("Imported");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("links a re-imported dataset to its imported experiment in new mode", async () => {
    const { result } = renderHook(useAll, { wrapper });
    act(() => {
      result.current.ws.createProject();
    });
    // Two experiments, so E1's internal id here differs from its id in the new project.
    act(() => {
      const first = result.current.app.addExperiment();
      result.current.app.updateExperiment(first, { experiment_id: "E0" });
      const second = result.current.app.addExperiment();
      result.current.app.updateExperiment(second, { experiment_id: "E1" });
    });
    vi.mocked(importMetadata).mockResolvedValueOnce({
      projectData: { project_id: "P1", research_project: "Imported" },
      experiments: [{ formData: { experiment_id: "E1", name: "Exp" } }],
      datasets: [{ formData: { name: "DS", experiment_id: "E1" } }],
    } as unknown as ImportResult);
    await pickFile(result);

    const options = result.current.flow.previewProps.getExperimentLinkOptions("dataset-0");
    expect(options.some((o) => o.value.startsWith("existing-"))).toBe(false);

    act(() => result.current.flow.previewProps.onImport());
    expect(result.current.ws.projects).toHaveLength(2);
    const state = result.current.ws.activeProject?.state;
    expect(state?.experiments).toHaveLength(1);
    expect(state?.datasets[0].linking?.linkedExperimentInternalId).toBe(state?.experiments[0].id);
  });

  it("does not import a file with duplicate experiment ids in new mode", async () => {
    const { result } = renderHook(useAll, { wrapper });
    vi.mocked(importMetadata).mockResolvedValueOnce({
      projectData: { project_id: "P1" },
      experiments: [{ formData: { experiment_id: "E1" } }, { formData: { experiment_id: "E1" } }],
      datasets: [],
    } as unknown as ImportResult);
    await pickFile(result);
    expect(result.current.flow.previewProps.duplicateExperimentIdError).not.toBeNull();

    act(() => result.current.flow.previewProps.onImport());
    expect(result.current.ws.projects).toHaveLength(0);
  });
});
