import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { emptyProjectState, newProjectRecord, type ProjectState } from "@/workspace/types";
import {
  addDatasetAtom,
  addExperimentAtom,
  createProjectAtom,
  deleteDatasetAtom,
  deleteExperimentAtom,
  deleteProjectAtom,
  duplicateDatasetAtom,
  duplicateExperimentAtom,
  importAsNewProjectAtom,
  importSelectedDataAtom,
  replaceDatasetFormDataAtom,
  replaceExperimentFormDataAtom,
  switchProjectAtom,
  toggleJsonPreviewAtom,
  updateDatasetLinkingAtom,
  updateProjectDataAtom,
} from "../actions";
import {
  activeDatasetIdAtom,
  activeExperimentIdAtom,
  activeProjectAtom,
  projectStateAtom,
  showJsonPreviewAtom,
  workspaceAtom,
} from "../atoms";

const named = (research_project: string): ProjectState => ({
  ...emptyProjectState(),
  projectData: { project_id: "", research_project },
});

const byId = (store: ReturnType<typeof createStore>, id: string) =>
  store.get(workspaceAtom).projects.find((p) => p.id === id);

describe("workspace actions", () => {
  it("create returns the new id and makes it active", () => {
    const store = createStore();
    const id = store.set(createProjectAtom);
    expect(store.get(workspaceAtom).activeProjectId).toBe(id);
    expect(byId(store, id)?.state).toEqual(emptyProjectState());
  });

  it("creates, switches, and deletes projects", () => {
    const store = createStore();
    const first = store.set(createProjectAtom);
    const second = store.set(createProjectAtom);
    expect(store.get(workspaceAtom).activeProjectId).toBe(second);

    store.set(switchProjectAtom, first);
    expect(store.get(workspaceAtom).activeProjectId).toBe(first);

    store.set(deleteProjectAtom, first);
    expect(store.get(workspaceAtom).activeProjectId).toBe(second);
    expect(store.get(workspaceAtom).projects).toHaveLength(1);
  });

  it("deleting the last project leaves no active project", () => {
    const store = createStore();
    const id = store.set(createProjectAtom);
    store.set(deleteProjectAtom, id);
    expect(store.get(workspaceAtom).projects).toHaveLength(0);
    expect(store.get(activeProjectAtom)).toBeNull();
  });

  it("imports as a new project and drops a link to an experiment that isn't in it", () => {
    const store = createStore();
    const id = store.set(importAsNewProjectAtom, {
      project: { project_id: "P2", research_project: "Imported" },
      experiments: [],
      datasets: [
        {
          formData: { name: "DS" },
          experimentLinking: { mode: "explicit", explicitExperimentInternalId: 1 },
        },
      ],
    });
    const active = store.get(activeProjectAtom);
    expect(active?.id).toBe(id);
    expect(active?.state.projectData.research_project).toBe("Imported");
    expect(active?.state.datasets[0].linking?.linkedExperimentInternalId).toBeNull();
    expect(store.get(workspaceAtom).projects).toHaveLength(1);
  });
});

describe("project actions", () => {
  /** Two projects with B active; returns A's untouched state for comparison. */
  function setup() {
    const store = createStore();
    const a = newProjectRecord(named("A"), 100);
    store.set(workspaceAtom, {
      version: 1,
      activeProjectId: null,
      projects: [a],
    });
    const b = store.set(createProjectAtom);
    const untouched = () => expect(byId(store, a.id)?.state).toBe(a.state);
    return { store, a: a.id, b, untouched };
  }

  it("do nothing and return 0 with no active project", () => {
    const store = createStore();
    const before = store.get(workspaceAtom);
    expect(store.set(addExperimentAtom)).toBe(0);
    expect(store.set(addDatasetAtom)).toBe(0);
    store.set(updateProjectDataAtom, { project_id: "X" });
    expect(store.get(workspaceAtom)).toBe(before);
  });

  it("updateProjectData propagates project_id within the active project", () => {
    const { store, untouched } = setup();
    store.set(addExperimentAtom);
    store.set(addDatasetAtom);
    store.set(updateProjectDataAtom, { project_id: "P1" });

    const state = store.get(projectStateAtom);
    expect(state.projectData.project_id).toBe("P1");
    expect(state.experiments[0].formData.project_id).toBe("P1");
    expect(state.datasets[0].formData.project_id).toBe("P1");
    untouched();
  });

  it("addExperiment returns the id and selects it", () => {
    const { store, untouched } = setup();
    const first = store.set(addExperimentAtom);
    const second = store.set(addExperimentAtom, "Named");
    expect([first, second]).toEqual([1, 2]);
    expect(store.get(activeExperimentIdAtom)).toBe(2);
    expect(store.get(projectStateAtom).experiments.map((e) => e.name)).toEqual([
      "Experiment 1",
      "Named",
    ]);
    untouched();
  });

  it("replaceExperimentFormData replaces formData and propagates experiment_id", () => {
    const { store, untouched } = setup();
    const exp = store.set(addExperimentAtom);
    const ds = store.set(addDatasetAtom);
    store.set(updateDatasetLinkingAtom, ds, { linkedExperimentInternalId: exp });
    store.set(replaceExperimentFormDataAtom, exp, { experiment_id: "E1", name: "Renamed" });

    const state = store.get(projectStateAtom);
    expect(state.experiments[0].name).toBe("Renamed");
    expect(state.experiments[0].formData).toEqual({ experiment_id: "E1", name: "Renamed" });
    expect(state.datasets[0].formData.experiment_id).toBe("E1");
    untouched();
  });

  it("deleting the selected experiment selects the first remaining one", () => {
    const { store, untouched } = setup();
    store.set(addExperimentAtom);
    const second = store.set(addExperimentAtom);
    store.set(addExperimentAtom);
    store.set(activeExperimentIdAtom, second);
    store.set(deleteExperimentAtom, second);

    expect(store.get(projectStateAtom).experiments.map((e) => e.id)).toEqual([1, 3]);
    expect(store.get(activeExperimentIdAtom)).toBe(1);
    untouched();
  });

  it("duplicating or deleting another record keeps the selection", () => {
    const { store } = setup();
    const first = store.set(addExperimentAtom);
    const second = store.set(addExperimentAtom);
    store.set(duplicateExperimentAtom, second);
    store.set(deleteExperimentAtom, first);
    expect(store.get(activeExperimentIdAtom)).toBe(second);

    store.set(addDatasetAtom);
    const dataset = store.set(addDatasetAtom);
    store.set(duplicateDatasetAtom, dataset);
    expect(store.get(activeDatasetIdAtom)).toBe(dataset);
  });

  it("deleting the last experiment leaves no selection", () => {
    const { store } = setup();
    store.set(deleteExperimentAtom, store.set(addExperimentAtom));
    expect(store.get(activeExperimentIdAtom)).toBeNull();
  });

  it("duplicateExperiment returns the new id, or 0 for an unknown one", () => {
    const { store, untouched } = setup();
    const exp = store.set(addExperimentAtom, "Original");
    const copy = store.set(duplicateExperimentAtom, exp);
    expect(copy).toBe(2);
    expect(store.get(projectStateAtom).experiments[1].name).toBe("Original (Copy)");
    expect(store.set(duplicateExperimentAtom, 99)).toBe(0);
    untouched();
  });

  it("addDataset returns the id and selects it", () => {
    const { store, untouched } = setup();
    store.set(addDatasetAtom);
    const second = store.set(addDatasetAtom, "Named");
    expect(second).toBe(2);
    expect(store.get(activeDatasetIdAtom)).toBe(2);
    expect(store.get(projectStateAtom).datasets[1].name).toBe("Named");
    untouched();
  });

  it("replaceDatasetFormData replaces the dataset's formData", () => {
    const { store, untouched } = setup();
    const ds = store.set(addDatasetAtom);
    store.set(replaceDatasetFormDataAtom, ds, { name: "Replaced" });
    expect(store.get(projectStateAtom).datasets[0]).toMatchObject({
      name: "Replaced",
      formData: { name: "Replaced" },
    });
    untouched();
  });

  it("deleting the selected dataset selects the first remaining one", () => {
    const { store, untouched } = setup();
    store.set(addDatasetAtom);
    const second = store.set(addDatasetAtom);
    store.set(deleteDatasetAtom, second);
    expect(store.get(projectStateAtom).datasets.map((d) => d.id)).toEqual([1]);
    expect(store.get(activeDatasetIdAtom)).toBe(1);
    untouched();
  });

  it("duplicateDataset returns the new id, or 0 for an unknown one", () => {
    const { store, untouched } = setup();
    const ds = store.set(addDatasetAtom, "Original");
    expect(store.set(duplicateDatasetAtom, ds)).toBe(2);
    expect(store.get(projectStateAtom).datasets[1].name).toBe("Original (Copy)");
    expect(store.set(duplicateDatasetAtom, 99)).toBe(0);
    untouched();
  });

  it("updateDatasetLinking copies the linked experiment's experiment_id", () => {
    const { store, untouched } = setup();
    const exp = store.set(addExperimentAtom);
    store.set(replaceExperimentFormDataAtom, exp, { experiment_id: "E1" });
    const ds = store.set(addDatasetAtom);
    store.set(updateDatasetLinkingAtom, ds, { linkedExperimentInternalId: exp });

    const dataset = store.get(projectStateAtom).datasets[0];
    expect(dataset.linking?.linkedExperimentInternalId).toBe(exp);
    expect(dataset.formData.experiment_id).toBe("E1");
    untouched();
  });

  it("importSelectedData merges into the active project", () => {
    const { store, b, untouched } = setup();
    store.set(importSelectedDataAtom, {
      project: { project_id: "P9", research_project: "Merged" },
      experiments: [{ experiment_id: "E1" }],
      datasets: [],
    });

    expect(byId(store, b)?.state.projectData.research_project).toBe("Merged");
    expect(store.get(projectStateAtom).experiments).toHaveLength(1);
    untouched();
  });
});

describe("UI actions", () => {
  it("toggleJsonPreview flips the preview", () => {
    const store = createStore();
    store.set(toggleJsonPreviewAtom);
    expect(store.get(showJsonPreviewAtom)).toBe(true);
    store.set(toggleJsonPreviewAtom);
    expect(store.get(showJsonPreviewAtom)).toBe(false);
  });
});
