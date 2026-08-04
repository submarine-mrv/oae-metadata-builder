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
  it("coerces field variables on a model_output dataset to ModelVariable", () => {
    const parsed = parseDataset(
      {
        name: "Model run",
        dataset_type: "model_output",
        simulation_type: ["hindcast"],
        variables: [{ schema_class: "DiscretePHVariable", dataset_variable_name: "pH" }],
      },
      rootSchema,
    );
    expect(parsed.dataset_type).toBe("model_output");
    expect(parsed.simulation_type).toEqual(["hindcast"]);

    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables).toHaveLength(1);
    // The user's work is kept, re-classed and re-typed into the model vocabulary.
    expect(variables[0].schema_class).toBe("ModelVariable");
    expect(variables[0].variable_type).toBe("ph");
    expect(variables[0].dataset_variable_name).toBe("pH");
    // ModelVariable has neither, so strip must have removed them.
    expect(variables[0].genesis).toBeUndefined();
    expect(variables[0].sampling).toBeUndefined();
  });

  // schema_class is the source of truth, so a concrete class pins the type even
  // when a stored variable_type disagrees.
  it("coerces from the class, not a conflicting variable_type", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        variables: [{ schema_class: "DiscretePHVariable", variable_type: "dic" }],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables[0].variable_type).toBe("ph");
  });

  // CalculatedVariable is shared across types, so it pins nothing — an untyped
  // one must not inherit whichever type happens to reach it first in the map.
  it("coerces an untyped shared class to other, not an arbitrary type", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        variables: [{ schema_class: "CalculatedVariable" }],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables[0].variable_type).toBe("other");
  });

  it("honours a stored variable_type on a shared class", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        variables: [{ schema_class: "CalculatedVariable", variable_type: "ta" }],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables[0].variable_type).toBe("total_alkalinity");
  });

  // Hand-authored imports omit schema_class (it is auto-populated), and most
  // model types have no field equivalent to translate through.
  it("keeps a model-vocabulary variable_type on an import with no schema_class", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        variables: [
          { variable_type: "horizontal_velocity", dataset_variable_name: "uo" },
          { variable_type: "temperature", dataset_variable_name: "thetao" },
          { variable_type: "ph", dataset_variable_name: "ph" },
        ],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables.map((v) => v.variable_type)).toEqual([
      "horizontal_velocity",
      "temperature",
      "ph",
    ]);
    expect(variables.every((v) => v.schema_class === "ModelVariable")).toBe(true);
  });

  // Already classed ModelVariable, but carrying a field-vocabulary type.
  it("translates a field-vocabulary variable_type on an existing ModelVariable", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        variables: [
          { schema_class: "ModelVariable", variable_type: "pH" },
          { schema_class: "ModelVariable", variable_type: "ta" },
          { schema_class: "ModelVariable", variable_type: "vertical_velocity" },
        ],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables.map((v) => v.variable_type)).toEqual([
      "ph",
      "total_alkalinity",
      "vertical_velocity",
    ]);
  });

  // A field-vocabulary value with no schema_class still translates.
  it("translates a field-vocabulary variable_type on an import with no schema_class", () => {
    const parsed = parseDataset(
      { dataset_type: "model_output", variables: [{ variable_type: "pH" }] },
      rootSchema,
    );
    expect((parsed.variables as Record<string, unknown>[])[0].variable_type).toBe("ph");
  });

  it("maps a model variable_type with no field equivalent to other", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        variables: [{ schema_class: "HPLCVariable", variable_type: "hplc" }],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables[0].schema_class).toBe("ModelVariable");
    expect(variables[0].variable_type).toBe("other");
  });

  it("coerces model variables back out when switching to a field dataset", () => {
    const parsed = parseDataset(
      {
        dataset_type: "cast",
        variables: [
          {
            schema_class: "ModelVariable",
            variable_type: "air_sea_co2_flux",
            dataset_variable_name: "fgco2",
            long_name: "Air-sea CO2 flux",
            units: "mol m-2 s-1",
          },
        ],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    // air_sea_co2_flux has no VariableType equivalent, so it falls back to other.
    expect(variables[0].schema_class).toBe("CalculatedVariable");
    expect(variables[0].variable_type).toBe("other");
    expect(variables[0].genesis).toBe("calculated");
    expect(variables[0].dataset_variable_name).toBe("fgco2");
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
    // Enforced by `tsc -b` (the CI Build job type-checks test files), not by
    // vitest: if the union ever stops rejecting this, tsc fails with an
    // "unused @ts-expect-error directive" error.
    // @ts-expect-error - model is exclusive; this combination must not typecheck
    const invalid: ExperimentTypes = ["model", "intervention"];
    const model: ExperimentTypes = ["model"];
    const combo: ExperimentTypes = ["intervention", "tracer_study"];
    expect(invalid).toBeDefined();
    expect(model).toBeDefined();
    expect(combo).toBeDefined();
  });
});
