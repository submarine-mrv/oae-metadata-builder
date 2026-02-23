import { describe, it, expect } from "vitest";
import {
  getValidDatasetFieldsForType,
  cleanDatasetFormDataForType
} from "../datasetFields";

describe("getValidDatasetFieldsForType", () => {
  it("includes base fields for all types", () => {
    const fieldFields = getValidDatasetFieldsForType("cast");
    const modelFields = getValidDatasetFieldsForType("model_output");

    for (const base of ["name", "description", "project_id", "dataset_type"]) {
      expect(fieldFields.has(base)).toBe(true);
      expect(modelFields.has(base)).toBe(true);
    }
  });

  it("includes field-specific fields for non-model types", () => {
    const fields = getValidDatasetFieldsForType("cast");
    expect(fields.has("platform_info")).toBe(true);
    expect(fields.has("variables")).toBe(true);
    expect(fields.has("calibration_files")).toBe(true);
  });

  it("excludes field-specific fields for model_output", () => {
    const fields = getValidDatasetFieldsForType("model_output");
    expect(fields.has("platform_info")).toBe(false);
    expect(fields.has("variables")).toBe(false);
    expect(fields.has("calibration_files")).toBe(false);
  });

  it("includes model-specific fields for model_output", () => {
    const fields = getValidDatasetFieldsForType("model_output");
    expect(fields.has("simulation_type")).toBe(true);
    expect(fields.has("hardware_configuration")).toBe(true);
    expect(fields.has("model_output_variables")).toBe(true);
  });

  it("excludes model-specific fields for non-model types", () => {
    const fields = getValidDatasetFieldsForType("cast");
    expect(fields.has("simulation_type")).toBe(false);
    expect(fields.has("hardware_configuration")).toBe(false);
    expect(fields.has("model_output_variables")).toBe(false);
  });
});

describe("cleanDatasetFormDataForType", () => {
  // Simulates: user fills in a FieldDataset, then switches to model_output.
  // platform_info and other field-specific data should be stripped.
  it("strips field-dataset fields when switching to model_output", () => {
    const formData = {
      name: "My Dataset",
      dataset_type: "model_output",
      platform_info: { name: "R/V Test", platform_type: "ship" },
      variables: [{ variable_name: "salinity" }],
      calibration_files: ["cal.csv"],
      simulation_type: "perturbation"
    };

    const cleaned = cleanDatasetFormDataForType(formData, "model_output");

    expect(cleaned.name).toBe("My Dataset");
    expect(cleaned.simulation_type).toBe("perturbation");
    expect(cleaned).not.toHaveProperty("platform_info");
    expect(cleaned).not.toHaveProperty("variables");
    expect(cleaned).not.toHaveProperty("calibration_files");
  });

  // Simulates: user fills in a ModelOutputDataset, then switches to a field type.
  // model-specific fields should be stripped.
  it("strips model fields when switching to a field dataset type", () => {
    const formData = {
      name: "My Dataset",
      dataset_type: "cast",
      simulation_type: "perturbation",
      hardware_configuration: { cpu_count: 128 },
      platform_info: { name: "R/V Test" }
    };

    const cleaned = cleanDatasetFormDataForType(formData, "cast");

    expect(cleaned.name).toBe("My Dataset");
    expect(cleaned.platform_info).toEqual({ name: "R/V Test" });
    expect(cleaned).not.toHaveProperty("simulation_type");
    expect(cleaned).not.toHaveProperty("hardware_configuration");
  });

  // The actual bug: RJSF auto-initializes platform_info: {} while the default
  // FieldDataset schema is active. User picks model_output as their first type
  // selection. If cleanup doesn't run, the empty object leaks through and RJSF
  // renders it as an "additional property" (because ModelOutputDataset has
  // additionalProperties: true for conditional field support).
  it("strips auto-initialized field-dataset fields on first type selection to model_output", () => {
    const formData = {
      dataset_type: "model_output",
      platform_info: {}
    };

    const cleaned = cleanDatasetFormDataForType(formData, "model_output");

    expect(cleaned.dataset_type).toBe("model_output");
    expect(cleaned).not.toHaveProperty("platform_info");
  });

  it("preserves all fields when type matches", () => {
    const formData = {
      name: "Test",
      dataset_type: "cast",
      platform_info: { name: "Ship" },
      variables: []
    };

    const cleaned = cleanDatasetFormDataForType(formData, "cast");

    expect(cleaned).toEqual(formData);
  });

  it("handles empty form data", () => {
    const cleaned = cleanDatasetFormDataForType({}, "model_output");
    expect(cleaned).toEqual({});
  });
});
