import { describe, expect, it } from "vitest";
import type { DraftDataset, DraftExperiment, ExperimentRecord } from "@/types/forms";
import { emptyProjectState } from "@/workspace/types";
import { parseProjectState } from "../parseProjectState";

describe("parseProjectState", () => {
  it("drops a stored top-level experiment_types copy", () => {
    const parsed = parseProjectState({
      ...emptyProjectState(),
      experiments: [
        {
          id: 1,
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
          id: 1,
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
          id: 1,
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
