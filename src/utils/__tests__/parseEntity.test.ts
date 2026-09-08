import { describe, expect, it } from "vitest";
import type { JSONSchema } from "@/components/schemaUtils";
import bundled from "@/schema/schema.bundled.json";
import type { DraftExperiment, ExperimentTypes } from "@/types/forms";
import { parseDataset, parseExperiment, parseProject } from "@/utils/parseEntity";
import { validateDataset } from "@/utils/validation";

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
  // Pre-0.2.0 model datasets stored a multivalued enum checklist in
  // `model_output_variables`. The field is gone from the schema, so importing or
  // restoring one must drop it silently rather than error. Users re-add their
  // variables through the UI.
  it("drops the retired model_output_variables checklist without erroring", () => {
    const parsed = parseDataset(
      {
        name: "Legacy model run",
        dataset_type: "model_output",
        simulation_type: ["perturbation"],
        model_output_variables: ["phytoplankton", "horizontal_velocity", "ph"],
      },
      rootSchema,
    );

    expect(parsed.model_output_variables).toBeUndefined();
    // Everything else on the dataset survives untouched.
    expect(parsed.name).toBe("Legacy model run");
    expect(parsed.dataset_type).toBe("model_output");
    expect(parsed.simulation_type).toEqual(["perturbation"]);
    // No variables are invented in its place — the user adds them in the UI.
    expect(parsed.variables).toBeUndefined();
  });

  // An otherwise-complete legacy model dataset must come out of parse fully
  // valid, so the only work left for the user is adding variables. Asserting the
  // whole error list (not just model_output_variables ones) keeps this honest —
  // a filtered assertion would pass even if the fixture were invalid elsewhere.
  it("leaves a legacy model dataset fully valid once the retired field is dropped", () => {
    const parsed = parseDataset(
      {
        name: "Legacy model run",
        description: "A model run saved before 0.2.0",
        project_id: "proj-1",
        experiment_id: "exp-1",
        dataset_type: "model_output",
        data_accessibility: "open_access",
        // Open access needs a link or an access date as of protocol 0.4.0.
        data_access_link: "https://doi.org/10.25921/example",
        data_submitter: { name: "A Researcher", email: "researcher@example.org" },
        filenames: ["output.nc"],
        simulation_type: ["counterfactual"],
        start_datetime: "2026-01-01T00:00:00Z",
        end_datetime: "2026-02-01T00:00:00Z",
        model_output_variables: ["phytoplankton"],
      },
      rootSchema,
    );

    expect(parsed.model_output_variables).toBeUndefined();
    expect(validateDataset(parsed).errors).toEqual([]);
  });

  it("coerces field variables on a model_output dataset to ModelOutputVariable", () => {
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
    expect(variables[0].schema_class).toBe("ModelOutputVariable");
    expect(variables[0].variable_type).toBe("ph");
    expect(variables[0].dataset_variable_name).toBe("pH");
    // ModelOutputVariable has neither, so strip must have removed them.
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
          { variable_type: "zonal_velocity", dataset_variable_name: "uo" },
          { variable_type: "meridional_velocity", dataset_variable_name: "vo" },
          { variable_type: "temperature", dataset_variable_name: "thetao" },
          { variable_type: "ph", dataset_variable_name: "ph" },
        ],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables.map((v) => v.variable_type)).toEqual([
      "zonal_velocity",
      "meridional_velocity",
      "temperature",
      "ph",
    ]);
    expect(variables.every((v) => v.schema_class === "ModelOutputVariable")).toBe(true);
  });

  // Already classed ModelOutputVariable, but carrying a field-vocabulary type.
  it("translates a field-vocabulary variable_type on an existing ModelOutputVariable", () => {
    const parsed = parseDataset(
      {
        dataset_type: "model_output",
        variables: [
          { schema_class: "ModelOutputVariable", variable_type: "pH" },
          { schema_class: "ModelOutputVariable", variable_type: "ta" },
          { schema_class: "ModelOutputVariable", variable_type: "vertical_velocity" },
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
    expect(variables[0].schema_class).toBe("ModelOutputVariable");
    expect(variables[0].variable_type).toBe("other");
  });

  it("coerces model variables back out when switching to a field dataset", () => {
    const parsed = parseDataset(
      {
        dataset_type: "cast",
        variables: [
          {
            schema_class: "ModelOutputVariable",
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

  // temperature and salinity look like they should map across, but VariableType
  // has no such members — its `other` member is explicitly documented as covering
  // "temperature, salinity, conductivity, pressure, fluorescence". Mapping them
  // to themselves would write a value no field variable class accepts, so `other`
  // is the correct — and only valid — target. Do not "fix" this with an identity
  // mapping in FIELD_TO_MODEL_VARIABLE_TYPE.
  it("maps model temperature and salinity to the field vocabulary's other", () => {
    const parsed = parseDataset(
      {
        dataset_type: "cast",
        variables: [
          { schema_class: "ModelOutputVariable", variable_type: "temperature", long_name: "SST" },
          { schema_class: "ModelOutputVariable", variable_type: "salinity", long_name: "SSS" },
        ],
      },
      rootSchema,
    );
    const variables = parsed.variables as Record<string, unknown>[];
    expect(variables.map((v) => v.variable_type)).toEqual(["other", "other"]);
    // The identifying metadata the user typed survives the reclassification.
    expect(variables.map((v) => v.long_name)).toEqual(["SST", "SSS"]);
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
