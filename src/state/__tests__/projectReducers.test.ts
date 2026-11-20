import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { emptyProjectState, type ProjectState } from "@/workspace/types";
import {
  addDataset,
  addExperiment,
  deleteDataset,
  deleteExperiment,
  duplicateDataset,
  duplicateExperiment,
  importSelection,
  replaceDatasetFormData,
  replaceExperimentFormData,
  updateDatasetLinking,
  updateProjectData,
} from "../projectReducers";

const UUID = /^[0-9a-f-]{36}$/;

function experiment(n: number, formData: ExperimentRecord["formData"] = {}): ExperimentRecord {
  return { id: `e${n}`, name: `Experiment ${n}`, formData, createdAt: 0, updatedAt: 0 };
}

function dataset(
  n: number,
  linkedExperimentInternalId: string | null,
  formData: DatasetRecord["formData"] = {},
): DatasetRecord {
  return {
    id: `d${n}`,
    name: `Dataset ${n}`,
    formData,
    linking: { linkedExperimentInternalId },
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Project P with experiments E1 (id e1) and E2 (id e2); dataset d1 linked to E1, d2 unlinked. */
function seeded(): ProjectState {
  return {
    projectData: { project_id: "P" },
    experiments: [
      experiment(1, { project_id: "P", experiment_id: "E1" }),
      experiment(2, { project_id: "P", experiment_id: "E2" }),
    ],
    datasets: [
      dataset(1, "e1", { project_id: "P", experiment_id: "E1" }),
      dataset(2, null, { project_id: "P" }),
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(500);
});
afterEach(() => vi.useRealTimers());

describe("updateProjectData", () => {
  it("propagates a changed project_id to every experiment and dataset", () => {
    const next = updateProjectData(seeded(), { project_id: "NEW" });
    expect(next.projectData.project_id).toBe("NEW");
    expect(next.experiments.map((e) => e.formData.project_id)).toEqual(["NEW", "NEW"]);
    expect(next.datasets.map((d) => d.formData.project_id)).toEqual(["NEW", "NEW"]);
  });

  it("leaves experiments and datasets alone when project_id is unchanged", () => {
    const prev = seeded();
    const next = updateProjectData(prev, { project_id: "P", name: "R" });
    expect(next.projectData.name).toBe("R");
    expect(next.experiments).toBe(prev.experiments);
    expect(next.datasets).toBe(prev.datasets);
  });
});

describe("replaceExperimentFormData", () => {
  it("drops fields missing from the payload, keeps the name and touches only that experiment", () => {
    const prev = seeded();
    prev.experiments[0].formData.description = "old";
    const next = replaceExperimentFormData(prev, "e1", {
      project_id: "P",
      experiment_id: "E1",
      experiment_types: [],
    });
    expect(next.experiments[0]).toMatchObject({ name: "Experiment 1", updatedAt: 500 });
    expect(next.experiments[0].formData).toEqual({ project_id: "P", experiment_id: "E1" });
    expect(next.experiments[1]).toBe(prev.experiments[1]);
  });

  it("takes the display name from the form's name field", () => {
    const next = replaceExperimentFormData(seeded(), "e2", { experiment_id: "E2", name: "Two" });
    expect(next.experiments[1].name).toBe("Two");
  });
});

describe("experiment_id propagation", () => {
  it("sends a new experiment_id only to linked datasets", () => {
    const next = replaceExperimentFormData(seeded(), "e1", { experiment_id: "E1b" });
    expect(next.datasets[0].formData.experiment_id).toBe("E1b");
    expect(next.datasets[1].formData.experiment_id).toBeUndefined();
  });

  it("clears linked datasets when experiment_id is cleared", () => {
    for (const experiment_id of [undefined, ""]) {
      const next = replaceExperimentFormData(seeded(), "e1", { project_id: "P", experiment_id });
      expect(next.datasets[0].formData.experiment_id).toBeUndefined();
    }
  });

  it("leaves datasets untouched when experiment_id is unchanged", () => {
    const prev = seeded();
    const next = replaceExperimentFormData(prev, "e1", { experiment_id: "E1", name: "Renamed" });
    expect(next.experiments[0].name).toBe("Renamed");
    expect(next.datasets).toBe(prev.datasets);
  });

  it("an unlinked experiment does not touch other datasets", () => {
    const next = replaceExperimentFormData(seeded(), "e2", { experiment_id: "E2b" });
    expect(next.datasets[0].formData.experiment_id).toBe("E1");
    expect(next.datasets[1].formData.experiment_id).toBeUndefined();
  });
});

describe("replaceDatasetFormData", () => {
  it("replaces formData so cleared fields are gone", () => {
    const prev = seeded();
    prev.datasets[1].formData.description = "old";
    const next = replaceDatasetFormData(prev, "d2", { project_id: "P", name: "DS two" });
    expect(next.datasets[1].formData).toEqual({ project_id: "P", name: "DS two" });
    expect(next.datasets[1].name).toBe("DS two");
  });
});

describe("add", () => {
  it("addExperiment returns a new UUID and copies project_id", () => {
    const { state, id } = addExperiment(seeded());
    expect(id).toMatch(UUID);
    expect(state.experiments.at(-1)).toMatchObject({
      id,
      name: "Experiment 3",
      formData: { project_id: "P" },
      createdAt: 500,
      updatedAt: 500,
    });
  });

  it("addExperiment uses a given name", () => {
    const { state } = addExperiment(emptyProjectState(), "Mine");
    expect(state.experiments[0].name).toBe("Mine");
  });

  it("addDataset returns a new UUID and starts unlinked", () => {
    const { state, id } = addDataset(seeded());
    expect(id).toMatch(UUID);
    expect(state.datasets.at(-1)).toMatchObject({
      id,
      name: "Dataset 3",
      formData: { project_id: "P" },
      linking: { linkedExperimentInternalId: null },
    });
  });
});

describe("duplicate", () => {
  it("duplicateExperiment appends (Copy), syncs formData.name and drops experiment_id", () => {
    const prev = seeded();
    prev.experiments[0].formData.name = "Experiment 1";
    prev.experiments[0].formData.experiment_types = ["intervention"];
    const { state, id } = duplicateExperiment(prev, "e1");
    const copy = state.experiments.find((e) => e.id === id);
    expect(id).toMatch(UUID);
    expect(copy?.name).toBe("Experiment 1 (Copy)");
    expect(copy?.formData.name).toBe("Experiment 1 (Copy)");
    expect(copy?.formData.experiment_id).toBeUndefined();
    expect(prev.experiments[0].formData.experiment_id).toBe("E1");
    expect(copy?.formData.experiment_types).toEqual(["intervention"]);
    expect(copy?.formData.experiment_types).not.toBe(prev.experiments[0].formData.experiment_types);
  });

  it("duplicateDataset appends (Copy) and keeps the experiment link", () => {
    const prev = seeded();
    const { state, id } = duplicateDataset(prev, "d1");
    const copy = state.datasets.find((d) => d.id === id);
    expect(id).toMatch(UUID);
    expect(copy?.name).toBe("Dataset 1 (Copy)");
    expect(copy?.linking?.linkedExperimentInternalId).toBe("e1");
    expect(copy?.formData.experiment_id).toBe("E1");
    expect(copy?.formData).not.toBe(prev.datasets[0].formData);
    expect(copy?.linking).not.toBe(prev.datasets[0].linking);
  });

  it("returns the same state and an empty id for an unknown id", () => {
    const prev = seeded();
    expect(duplicateExperiment(prev, "missing")).toEqual({ state: prev, id: "" });
    expect(duplicateDataset(prev, "missing").state).toBe(prev);
  });
});

describe("delete", () => {
  it("deleteExperiment removes only that experiment", () => {
    const next = deleteExperiment(seeded(), "e1");
    expect(next.experiments.map((e) => e.id)).toEqual(["e2"]);
  });

  it("deleteDataset removes only that dataset", () => {
    const next = deleteDataset(seeded(), "d2");
    expect(next.datasets.map((d) => d.id)).toEqual(["d1"]);
  });

  it("an unknown id removes nothing", () => {
    const prev = seeded();
    expect(deleteExperiment(prev, "missing").experiments).toEqual(prev.experiments);
    expect(deleteDataset(prev, "missing").datasets).toEqual(prev.datasets);
  });
});

describe("updateDatasetLinking", () => {
  it("linking to an experiment copies its experiment_id", () => {
    const next = updateDatasetLinking(seeded(), "d2", { linkedExperimentInternalId: "e2" });
    expect(next.datasets[1].linking?.linkedExperimentInternalId).toBe("e2");
    expect(next.datasets[1].formData.experiment_id).toBe("E2");
  });

  it("unlinking keeps the current experiment_id", () => {
    const next = updateDatasetLinking(seeded(), "d1", { linkedExperimentInternalId: null });
    expect(next.datasets[0].linking?.linkedExperimentInternalId).toBeNull();
    expect(next.datasets[0].formData.experiment_id).toBe("E1");
  });
});

describe("importSelection", () => {
  it("merges the selection through applyImport", () => {
    const next = importSelection(seeded(), {
      project: null,
      experiments: [{ experiment_id: "E3", name: "Third" }],
      datasets: [],
    });
    expect(next.experiments.at(-1)).toMatchObject({
      id: expect.stringMatching(UUID),
      name: "Third",
    });
    expect(next.experiments.at(-1)?.formData.project_id).toBe("P");
  });
});
