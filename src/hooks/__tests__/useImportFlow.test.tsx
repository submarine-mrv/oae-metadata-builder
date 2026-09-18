import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider, useAppState } from "@/contexts/AppStateContext";
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
});
