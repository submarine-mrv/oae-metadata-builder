import { describe, expect, it } from "vitest";
import type { JSONSchema } from "@/components/schemaUtils";
import bundled from "@/schema/schema.bundled.json";
import type { DraftExperiment, ExperimentTypes } from "@/types/forms";
import { parseDataset, parseExperiment, parseProject } from "@/utils/parseEntity";

const rootSchema = bundled as unknown as JSONSchema;

describe("parseProject", () => {
  it('drops nulls, empty arrays, and empty objects (empty strings survive — auto-propagated IDs start as "")', () => {
    const parsed = parseProject({
      project_id: "proj-1",
      name: "",
      description: null,
      funding: {},
      links: [],
    });
    expect(parsed).toEqual({ project_id: "proj-1", name: "" });
  });

  it("degrades non-object input to an empty draft", () => {
    expect(parseProject(null)).toEqual({});
    expect(parseProject("junk")).toEqual({});
    expect(parseProject([1, 2])).toEqual({});
  });
});

describe("parseExperiment", () => {
  it("statically resolves model + intervention to model on import/restore (no prev)", () => {
    const parsed = parseExperiment({
      experiment_id: "exp-1",
      experiment_types: ["model", "intervention"],
    });
    expect(parsed.experiment_types).toEqual(["model"]);
  });

  it("drops fields of other types for the resolved schema type (import hole)", () => {
    // model + intervention resolves to model; intervention-only fields must go
    const parsed = parseExperiment({
      experiment_id: "exp-1",
      experiment_types: ["model", "intervention"],
      dosing_description: "should not survive",
      model_configuration: "should survive",
    });
    expect(parsed.experiment_types).toEqual(["model"]);
    expect(parsed.dosing_description).toBeUndefined();
    expect(parsed.model_configuration).toBe("should survive");
  });

  it("applies the recency rule when prev is given: adding a type while model was selected drops model", () => {
    const prev: DraftExperiment = { experiment_types: ["model"] };
    const parsed = parseExperiment(
      { experiment_types: ["model", "intervention"], dosing_description: "kept" },
      prev,
    );
    expect(parsed.experiment_types).toEqual(["intervention"]);
    expect(parsed.dosing_description).toBe("kept");
  });

  it("applies the recency rule when prev is given: newly adding model drops the others", () => {
    const prev: DraftExperiment = { experiment_types: ["intervention"] };
    const parsed = parseExperiment({ experiment_types: ["intervention", "model"] }, prev);
    expect(parsed.experiment_types).toEqual(["model"]);
  });

  it("drops conditional custom fields whose trigger is not met", () => {
    const parsed = parseExperiment({
      experiment_types: ["intervention"],
      alkalinity_feedstock: "olivine",
      alkalinity_feedstock_custom: "orphaned",
    });
    expect(parsed.alkalinity_feedstock_custom).toBeUndefined();

    const kept = parseExperiment({
      experiment_types: ["intervention"],
      alkalinity_feedstock: "other",
      alkalinity_feedstock_custom: "still here",
    });
    expect(kept.alkalinity_feedstock_custom).toBe("still here");
  });

  it("is a no-op on already-valid drafts apart from cleanup", () => {
    const parsed = parseExperiment({
      experiment_id: "exp-2",
      experiment_types: ["baseline", "control"],
      description: "fine",
    });
    expect(parsed).toEqual({
      experiment_id: "exp-2",
      experiment_types: ["baseline", "control"],
      description: "fine",
    });
  });

  it("degrades non-object input to an empty draft", () => {
    expect(parseExperiment(undefined)).toEqual({});
  });
});

describe("parseDataset", () => {
  it("drops variables from model_output datasets (import hole)", () => {
    const parsed = parseDataset(
      {
        name: "Model run",
        dataset_type: "model_output",
        simulation_type: ["hindcast"],
        variables: [{ schema_class: "DiscretePHVariable", dataset_variable_name: "pH" }],
      },
      rootSchema,
    );
    expect(parsed.variables).toBeUndefined();
    expect(parsed.dataset_type).toBe("model_output");
    expect(parsed.simulation_type).toEqual(["hindcast"]);
  });

  it("drops field-dataset-only fields from model_output datasets", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        temporal_coverage: "2024-01-01/2024-02-01",
        platform_info: { name: "R/V Test" },
        output_frequency: "daily",
      },
      rootSchema,
    );
    expect(parsed.temporal_coverage).toBeUndefined();
    expect(parsed.platform_info).toBeUndefined();
    expect(parsed.output_frequency).toBe("daily");
  });

  it("parses variables on field datasets (normalize + strip + clean)", () => {
    const parsed = parseDataset(
      {
        dataset_type: "bottle",
        variables: [
          {
            schema_class: "NonMeasuredVariable",
            dataset_variable_name: "station_id",
            long_name: "",
          },
        ],
      },
      rootSchema,
    );
    expect(parsed.variables).toHaveLength(1);
    expect(parsed.variables?.[0].schema_class).toBe("NonMeasuredVariable");
    // empty string cleaned by the variable parse
    expect(parsed.variables?.[0].long_name).toBeUndefined();
  });

  it("still parses variables when dataset_type is not yet chosen", () => {
    const parsed = parseDataset(
      { variables: [{ schema_class: "NonMeasuredVariable", dataset_variable_name: "x" }] },
      rootSchema,
    );
    expect(parsed.variables).toHaveLength(1);
  });

  it("drops untriggered model-output conditional fields", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        simulation_type: ["hindcast"],
        mcdr_forcing_description: "orphaned",
      },
      rootSchema,
    );
    expect(parsed.mcdr_forcing_description).toBeUndefined();

    const kept = parseDataset(
      {
        dataset_type: "model_output",
        simulation_type: ["perturbation"],
        mcdr_forcing_description: "still here",
      },
      rootSchema,
    );
    expect(kept.mcdr_forcing_description).toBe("still here");
  });

  it("degrades non-object input to an empty draft", () => {
    expect(parseDataset(42, rootSchema)).toEqual({});
  });
});

describe("ExperimentTypes (type-level)", () => {
  it("makes model + intervention unconstructable", () => {
    // @ts-expect-error - model is exclusive; this combination must not typecheck
    const invalid: ExperimentTypes = ["model", "intervention"];
    const model: ExperimentTypes = ["model"];
    const combo: ExperimentTypes = ["intervention", "tracer_study"];
    expect(invalid).toBeDefined();
    expect(model).toBeDefined();
    expect(combo).toBeDefined();
  });
});
