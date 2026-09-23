import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addExperimentAtom,
  createProjectAtom,
  replaceExperimentFormDataAtom,
} from "@/state/actions";
import { activeProjectAtom, projectStateAtom, projectSummariesAtom } from "@/state/atoms";
import { createTestStore, makeWrapper } from "@/state/testing";
import type { ImportResult } from "@/types/forms";
import { importMetadata } from "@/utils/exportImport";
import { useImportFlow } from "../useImportFlow";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const payload = {
  projectData: { project_id: "P1", research_project: "Imported" },
  experiments: [],
  datasets: [],
};
vi.mock("@/utils/exportImport", () => ({ importMetadata: vi.fn(async () => payload) }));

function renderFlow() {
  const store = createTestStore();
  const { result } = renderHook(useImportFlow, { wrapper: makeWrapper(store) });
  return { result, store, projects: () => store.get(projectSummariesAtom) };
}

async function pickFile(result: { current: ReturnType<typeof useImportFlow> }) {
  const file = new File(["{}"], "f.json", { type: "application/json" });
  await act(async () => {
    await result.current.inputProps.onChange({
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
    const { result, store, projects } = renderFlow();
    await pickFile(result);
    expect(result.current.previewProps.opened).toBe(true);
    expect(result.current.previewProps.canMerge).toBe(false);

    act(() => result.current.previewProps.onImport());
    expect(projects()).toHaveLength(1);
    expect(projects()[0].name).toBe("Imported");
    expect(navigate).toHaveBeenCalledWith({ to: "/overview" });
    expect(result.current.previewProps.opened).toBe(false);
  });

  it("with a project, merge mode imports into the current session and opens the overview", async () => {
    const { result, store, projects } = renderFlow();
    act(() => {
      store.set(createProjectAtom);
    });
    await pickFile(result);
    expect(result.current.previewProps.canMerge).toBe(true);

    act(() => result.current.previewProps.onImportModeChange("merge"));
    act(() => result.current.previewProps.onImport());
    expect(projects()).toHaveLength(1);
    expect(store.get(projectStateAtom).projectData.research_project).toBe("Imported");
    expect(navigate).toHaveBeenCalledWith({ to: "/overview" });
  });

  it("links a re-imported dataset to its imported experiment in new mode", async () => {
    const { result, store, projects } = renderFlow();
    act(() => {
      store.set(createProjectAtom);
    });
    // Two experiments, so E1's internal id here differs from its id in the new project.
    act(() => {
      store.set(replaceExperimentFormDataAtom, store.set(addExperimentAtom), {
        experiment_id: "E0",
      });
      store.set(replaceExperimentFormDataAtom, store.set(addExperimentAtom), {
        experiment_id: "E1",
      });
    });
    vi.mocked(importMetadata).mockResolvedValueOnce({
      projectData: { project_id: "P1", research_project: "Imported" },
      experiments: [{ formData: { experiment_id: "E1", name: "Exp" } }],
      datasets: [{ formData: { name: "DS", experiment_id: "E1" } }],
    } as unknown as ImportResult);
    await pickFile(result);

    const options = result.current.previewProps.getExperimentLinkOptions("dataset-0");
    expect(options.some((o) => o.value.startsWith("existing-"))).toBe(false);

    act(() => result.current.previewProps.onImport());
    expect(projects()).toHaveLength(2);
    const state = store.get(activeProjectAtom)?.state;
    expect(state?.experiments).toHaveLength(1);
    expect(state?.datasets[0].linking?.linkedExperimentInternalId).toBe(state?.experiments[0].id);
  });

  it("does not import a file with duplicate experiment ids in new mode", async () => {
    const { result, store, projects } = renderFlow();
    vi.mocked(importMetadata).mockResolvedValueOnce({
      projectData: { project_id: "P1" },
      experiments: [{ formData: { experiment_id: "E1" } }, { formData: { experiment_id: "E1" } }],
      datasets: [],
    } as unknown as ImportResult);
    await pickFile(result);
    expect(result.current.previewProps.duplicateExperimentIdError).not.toBeNull();

    act(() => result.current.previewProps.onImport());
    expect(projects()).toHaveLength(0);
  });
});
