import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import type { WorkspaceStore } from "@/workspace/storage";
import {
  emptyProjectState,
  newProjectRecord,
  type ProjectRecord,
  type ProjectState,
} from "@/workspace/types";
import { addProject, emptyWorkspace, switchProject } from "@/workspace/workspace";
import {
  activeDatasetIdAtom,
  activeExperimentIdAtom,
  activeProjectAtom,
  projectStateAtom,
  workspaceAtom,
} from "../atoms";
import { hydrate } from "../store";

function experiment(id: number): ExperimentRecord {
  return { id, name: `Experiment ${id}`, formData: {}, createdAt: 0, updatedAt: 0 };
}

function dataset(id: number): DatasetRecord {
  return { id, name: `Dataset ${id}`, formData: {}, createdAt: 0, updatedAt: 0 };
}

function withEntities(experimentIds: number[], datasetIds: number[] = []): ProjectState {
  return {
    ...emptyProjectState(),
    experiments: experimentIds.map(experiment),
    datasets: datasetIds.map(dataset),
  };
}

function storeWith(...records: ProjectRecord[]) {
  const store = createStore();
  store.set(
    workspaceAtom,
    records.reduce((ws, r) => addProject(ws, r), emptyWorkspace()),
  );
  return store;
}

describe("activeProjectAtom", () => {
  it("is null with no projects", () => {
    expect(createStore().get(activeProjectAtom)).toBeNull();
  });

  it("falls back to the first project when the active id is unknown", () => {
    const a = newProjectRecord();
    const store = storeWith(a);
    store.set(workspaceAtom, (ws) => ({ ...ws, activeProjectId: "missing" }));
    expect(store.get(activeProjectAtom)?.id).toBe(a.id);
  });
});

describe("projectStateAtom", () => {
  it("reads an empty project state with no active project", () => {
    expect(createStore().get(projectStateAtom)).toEqual(emptyProjectState());
  });

  it("ignores writes with no active project", () => {
    const store = createStore();
    const before = store.get(workspaceAtom);
    store.set(projectStateAtom, withEntities([1]));
    expect(store.get(workspaceAtom)).toBe(before);
  });

  it("writes a value or an updater to the active project only", () => {
    const a = newProjectRecord(emptyProjectState(), 100);
    const b = newProjectRecord(emptyProjectState(), 100);
    const store = storeWith(a, b);

    store.set(projectStateAtom, withEntities([1]));
    store.set(projectStateAtom, (prev) => ({ ...prev, nextExperimentId: 9 }));

    const byId = (id: string) => store.get(workspaceAtom).projects.find((p) => p.id === id);
    expect(byId(b.id)?.state.experiments.map((e) => e.id)).toEqual([1]);
    expect(byId(b.id)?.state.nextExperimentId).toBe(9);
    expect(byId(a.id)?.state).toBe(a.state);
    expect(store.get(projectStateAtom)).toBe(byId(b.id)?.state);
  });
});

describe("active entity id atoms", () => {
  it("read the first entity of the active project by default", () => {
    const store = storeWith(newProjectRecord(withEntities([3, 4], [7])));
    expect(store.get(activeExperimentIdAtom)).toBe(3);
    expect(store.get(activeDatasetIdAtom)).toBe(7);
  });

  it("read null with no project or no entities", () => {
    expect(createStore().get(activeExperimentIdAtom)).toBeNull();
    const store = storeWith(newProjectRecord());
    expect(store.get(activeExperimentIdAtom)).toBeNull();
    expect(store.get(activeDatasetIdAtom)).toBeNull();
  });

  it("keep a selection within the project it was made in", () => {
    const a = newProjectRecord(withEntities([1, 2], [5, 6]));
    const b = newProjectRecord(withEntities([8, 9]));
    const store = storeWith(a, b);
    store.set(workspaceAtom, (ws) => switchProject(ws, a.id));

    store.set(activeExperimentIdAtom, 2);
    store.set(activeDatasetIdAtom, 6);
    expect(store.get(activeExperimentIdAtom)).toBe(2);
    expect(store.get(activeDatasetIdAtom)).toBe(6);

    store.set(workspaceAtom, (ws) => switchProject(ws, b.id));
    expect(store.get(activeExperimentIdAtom)).toBe(8);
    expect(store.get(activeDatasetIdAtom)).toBeNull();
  });

  it("read null once the selection is cleared", () => {
    const store = storeWith(newProjectRecord(withEntities([1, 2])));
    store.set(activeExperimentIdAtom, null);
    expect(store.get(activeExperimentIdAtom)).toBeNull();
  });

  it("fall back to the first entity once the selected one is deleted", () => {
    const store = storeWith(newProjectRecord(withEntities([1, 2])));
    store.set(activeExperimentIdAtom, 2);
    store.set(projectStateAtom, (prev) => ({
      ...prev,
      experiments: prev.experiments.filter((e) => e.id !== 2),
    }));
    expect(store.get(activeExperimentIdAtom)).toBe(1);
  });
});

describe("hydrate", () => {
  it("loads the saved workspace and parses each project", () => {
    const legacy = {
      ...experiment(1),
      experiment_types: ["baseline"],
    } as unknown as ExperimentRecord;
    const record = newProjectRecord({ ...emptyProjectState(), experiments: [legacy] }, 100);
    const workspaceStore: WorkspaceStore = {
      load: () => ({ version: 1, activeProjectId: record.id, projects: [record] }),
      save: () => {},
    };
    const store = createStore();
    hydrate(store, workspaceStore);

    const ws = store.get(workspaceAtom);
    expect(ws.activeProjectId).toBe(record.id);
    expect(ws.projects[0].updatedAt).toBe(100);
    expect(ws.projects[0].state.experiments[0]).not.toHaveProperty("experiment_types");
  });

  it("starts empty when nothing is saved", () => {
    const store = createStore();
    hydrate(store, { load: () => null, save: () => {} });
    expect(store.get(workspaceAtom)).toEqual(emptyWorkspace());
  });
});
