import { describe, expect, it } from "vitest";
import type { DraftDataset, DraftExperiment, ExperimentRecord } from "@/types/forms";
import { emptyProjectState } from "@/workspace/types";
import { parseProjectState } from "../parseProjectState";
import { isUuid } from "../stableUuid";
import { variableUuid } from "../variableUuid";

describe("parseProjectState", () => {
  it("drops a stored top-level experiment_types copy", () => {
    const parsed = parseProjectState({
      ...emptyProjectState(),
      experiments: [
        {
          id: "1",
          name: "Exp",
          formData: { experiment_id: "E1", experiment_types: ["intervention"] },
          // Older saves duplicated formData.experiment_types here.
          experiment_types: ["model", "intervention"],
          createdAt: 1,
          updatedAt: 1,
        } as ExperimentRecord,
      ],
    });
    expect(parsed.experiments[0]).not.toHaveProperty("experiment_types");
    expect(parsed.experiments[0].formData.experiment_types).toEqual(["intervention"]);
  });

  it("re-establishes model exclusivity and coerces variables on a model dataset", () => {
    const parsed = parseProjectState({
      ...emptyProjectState(),
      experiments: [
        {
          id: "1",
          name: "Legacy",
          formData: {
            experiment_id: "exp-legacy",
            experiment_types: ["model", "intervention"],
            dosing_description: "should be dropped",
          } as unknown as DraftExperiment,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      datasets: [
        {
          id: "1",
          name: "Legacy model output",
          formData: {
            dataset_type: "model_output",
            variables: [{ schema_class: "DiscretePHVariable" }],
          } as unknown as DraftDataset,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const exp = parsed.experiments[0].formData;
    expect(exp.experiment_types).toEqual(["model"]);
    expect(exp.dosing_description).toBeUndefined();

    // Coerced rather than dropped, so the user's work survives a restore.
    const variables = parsed.datasets[0].formData.variables as unknown as Record<string, unknown>[];
    expect(parsed.datasets[0].formData.dataset_type).toBe("model_output");
    expect(variables).toHaveLength(1);
    expect(variables[0]).toMatchObject({
      schema_class: "ModelOutputVariable",
      variable_type: "ph",
    });
  });
});

describe("legacy numeric IDs", () => {
  const legacy = {
    projectData: {},
    experiments: [
      { id: 1, name: "E1", formData: { experiment_id: "E1" }, createdAt: 1, updatedAt: 1 },
    ],
    datasets: [
      {
        id: 1,
        name: "D1",
        formData: { name: "D1" },
        createdAt: 1,
        updatedAt: 1,
        linking: { linkedExperimentInternalId: 1 },
      },
      {
        id: 2,
        name: "D2",
        formData: { name: "D2" },
        createdAt: 1,
        updatedAt: 1,
        linking: { linkedExperimentInternalId: 9 },
      },
    ],
    nextExperimentId: 2,
    nextDatasetId: 3,
  } as unknown as Parameters<typeof parseProjectState>[0];

  it("become the same string IDs everywhere, so every tab agrees", () => {
    const state = parseProjectState(legacy);
    expect(state.experiments[0].id).toBe("experiment-1");
    expect(state.datasets.map((dataset) => dataset.id)).toEqual(["dataset-1", "dataset-2"]);
    expect(state.datasets[0].linking?.linkedExperimentInternalId).toBe("experiment-1");
    expect(state.datasets[1].linking?.linkedExperimentInternalId).toBeNull();
    expect(state).not.toHaveProperty("nextExperimentId");
    expect(parseProjectState(state)).toEqual(state);
  });

  it("map to stable UUIDs for a cloud project, with links following and variable UUIDs", () => {
    const withVariables = {
      ...legacy,
      datasets: legacy.datasets.map((dataset) => ({
        ...dataset,
        formData: { ...dataset.formData, variables: [{ dataset_variable_name: "depth" }] },
      })),
    } as typeof legacy;
    const state = parseProjectState(withVariables, "project-a");
    const experiment = state.experiments[0].id;
    expect(isUuid(experiment)).toBe(true);
    expect(state.datasets.every((dataset) => isUuid(dataset.id))).toBe(true);
    expect(state.datasets[0].linking?.linkedExperimentInternalId).toBe(experiment);
    expect(state.datasets[1].linking?.linkedExperimentInternalId).toBeNull();
    const variable = (state.datasets[0].formData.variables as unknown[])[0];
    expect(isUuid(variableUuid(variable))).toBe(true);
    // Every tab maps them alike, other projects differently, and parsing again changes nothing.
    expect(parseProjectState(withVariables, "project-a")).toEqual(state);
    expect(parseProjectState(withVariables, "project-b").experiments[0].id).not.toBe(experiment);
    expect(parseProjectState(state, "project-a")).toEqual(state);
  });

  it("keep UUIDs and state every dataset's link for a cloud project", () => {
    const id = "0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3";
    const state = parseProjectState(
      {
        ...emptyProjectState(),
        datasets: [{ id, name: "D", formData: {}, createdAt: 1, updatedAt: 1 }],
      },
      "project-a",
    );
    expect(state.datasets[0].id).toBe(id);
    expect(state.datasets[0].linking).toEqual({ linkedExperimentInternalId: null });
  });
});
