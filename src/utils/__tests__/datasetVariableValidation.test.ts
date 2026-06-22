import { describe, expect, it } from "vitest";
import { validateDataset } from "@/utils/validation";

/**
 * End-to-end validation of polymorphic variables in a dataset: the bundled
 * schema discriminates `variables` on schema_class, so a single AJV pass
 * validates each variable against its own type and the errors are re-labeled
 * per variable for the UI.
 *
 * Tests filter to `.variables[N]` errors, so the surrounding dataset fields
 * don't need to be fully valid.
 */
const baseDataset = {
  project_id: "p1",
  experiment_id: "e1",
  name: "DS",
  description: "desc",
  temporal_coverage: "2024-01-01/2024-12-31",
  dataset_type: "cast",
  data_product_type: "raw_sensor_data",
  platform_info: {
    platform_type: "http://vocab.nerc.ac.uk/collection/L06/current/62/",
  },
  data_submitter: {
    name: "U",
    email: "u@x.com",
    affiliation: { name: "Org" },
  },
  filenames: ["data.csv"],
};

const variableErrors = (data: Record<string, unknown>) =>
  validateDataset(data, { hasExperiments: true }).errors.filter(
    (e) => e.property === ".variables[0]",
  );

describe("validateDataset — polymorphic variables", () => {
  it("routes an incomplete variable to its schema_class and labels errors by variable name", () => {
    const errors = variableErrors({
      ...baseDataset,
      variables: [
        {
          schema_class: "DiscretePHVariable",
          dataset_variable_name: "pH_total",
          long_name: "pH",
        },
      ],
    });

    expect(errors.length).toBeGreaterThan(0);
    // Every variable error is grouped under the variable's name.
    expect(errors.every((e) => e.message?.startsWith("Variable 'pH_total':"))).toBe(true);
    // Routed to the pH branch — a pH-specific required field is flagged.
    expect(errors.some((e) => /measurement_temperature/.test(e.message ?? ""))).toBe(true);
  });

  it("flags an orphan field on a variable (data is trusted clean, not re-stripped)", () => {
    const errors = variableErrors({
      ...baseDataset,
      variables: [
        {
          schema_class: "DiscretePHVariable",
          dataset_variable_name: "pH_total",
          long_name: "pH",
          not_a_real_field: "x",
        },
      ],
    });

    expect(errors.some((e) => /not_a_real_field/.test(e.message ?? ""))).toBe(true);
  });

  it("rejects a variable whose schema_class is unknown (discriminator)", () => {
    const errors = variableErrors({
      ...baseDataset,
      variables: [{ schema_class: "NotARealClass", dataset_variable_name: "x" }],
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.name === "variable")).toBe(true);
    expect(errors.some((e) => /must be in oneOf/.test(e.message ?? ""))).toBe(true);
  });

  it("does not flag CO2-specific fields against a pH variable (no cross-branch leakage)", () => {
    const errors = variableErrors({
      ...baseDataset,
      variables: [
        {
          schema_class: "DiscretePHVariable",
          dataset_variable_name: "pH_total",
          long_name: "pH",
        },
      ],
    });
    // standard_gas_info belongs to CO2 calibration, never to pH.
    expect(errors.some((e) => /standard_gas_info/.test(e.message ?? ""))).toBe(false);
  });

  it("groups per-variable errors by index for the (!) indicator", () => {
    const result = validateDataset(
      {
        ...baseDataset,
        variables: [
          {
            schema_class: "DiscretePHVariable",
            dataset_variable_name: "pH_total",
            long_name: "pH",
          },
          {
            schema_class: "DiscreteCO2Variable",
            dataset_variable_name: "xco2",
            long_name: "co2",
          },
        ],
      },
      { hasExperiments: true },
    );

    const byIndex = result.errorsByVariableIndex;
    expect(byIndex).toBeDefined();
    // Each incomplete variable has its own bucket of errors...
    expect(byIndex?.get(0)?.length ?? 0).toBeGreaterThan(0);
    expect(byIndex?.get(1)?.length ?? 0).toBeGreaterThan(0);
    // ...labeled for the right variable (no cross-contamination between buckets).
    expect(byIndex?.get(0)?.every((e) => e.message?.startsWith("Variable 'pH_total':"))).toBe(true);
    expect(byIndex?.get(1)?.every((e) => e.message?.startsWith("Variable 'xco2':"))).toBe(true);
  });
});
