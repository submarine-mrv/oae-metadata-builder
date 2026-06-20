import { describe, it, expect } from "vitest";
import { stripExtraVariableFields } from "../variableModalConfig";
import { getBaseSchema } from "@/utils/schemaViews";
import type { JSONSchema } from "@/components/schemaUtils";

// Minimal inline schema — no dependency on the bundled schema.
// Two classes: SimpleVariable (flat) and NestedVariable (has a nested object).
const TEST_SCHEMA = {
  $defs: {
    SimpleVariable: {
      type: "object",
      additionalProperties: false,
      properties: {
        schema_class: { type: "string" },
        name: { type: "string" },
        units: { type: "string" }
      }
    },
    NestedVariable: {
      type: "object",
      additionalProperties: false,
      properties: {
        schema_class: { type: "string" },
        name: { type: "string" },
        instrument: {
          $ref: "#/$defs/SimpleInstrument"
        }
      }
    },
    SimpleInstrument: {
      type: "object",
      additionalProperties: false,
      properties: {
        make: { type: "string" },
        model: { type: "string" }
      }
    }
  }
};

describe("stripExtraVariableFields", () => {
  it("preserves all valid top-level fields", () => {
    const v = { schema_class: "SimpleVariable", name: "salinity", units: "psu" };
    expect(stripExtraVariableFields(v, TEST_SCHEMA)).toEqual(v);
  });

  it("strips an extra top-level field", () => {
    const v = { schema_class: "SimpleVariable", name: "salinity", orphan: "stale" };
    const result = stripExtraVariableFields(v, TEST_SCHEMA);
    expect(result).toEqual({ schema_class: "SimpleVariable", name: "salinity" });
    expect(result).not.toHaveProperty("orphan");
  });

  it("strips extra fields inside a nested object", () => {
    const v = {
      schema_class: "NestedVariable",
      name: "pH",
      instrument: { make: "SeaBird", calibration_date: "2024-01-01" }
    };
    const result = stripExtraVariableFields(v, TEST_SCHEMA);
    expect((result.instrument as Record<string, unknown>)).not.toHaveProperty("calibration_date");
    expect((result.instrument as Record<string, unknown>).make).toBe("SeaBird");
  });

  it("preserves valid nested fields", () => {
    const v = {
      schema_class: "NestedVariable",
      name: "pH",
      instrument: { make: "SeaBird", model: "SBE18" }
    };
    expect(stripExtraVariableFields(v, TEST_SCHEMA)).toEqual(v);
  });

  it("returns the original object when schema_class is missing", () => {
    const v = { name: "salinity", orphan: "stale" };
    expect(stripExtraVariableFields(v, TEST_SCHEMA)).toBe(v);
  });

  it("returns the original object when schema_class is unknown", () => {
    const v = { schema_class: "NonexistentClass", name: "salinity" };
    expect(stripExtraVariableFields(v, TEST_SCHEMA)).toBe(v);
  });

  it("does not mutate the input variable", () => {
    const v = { schema_class: "SimpleVariable", name: "salinity", orphan: "stale" };
    const copy = { ...v };
    stripExtraVariableFields(v, TEST_SCHEMA);
    expect(v).toEqual(copy);
  });

  it("is idempotent — stripping twice gives the same result as once", () => {
    const v = { schema_class: "SimpleVariable", name: "salinity", orphan: "stale" };
    const once = stripExtraVariableFields(v, TEST_SCHEMA);
    const twice = stripExtraVariableFields(once, TEST_SCHEMA);
    expect(twice).toEqual(once);
  });

  it("strips extra fields even when required fields of the target schema are missing", () => {
    // Simulates switching variable type: new schema has required fields the data doesn't have yet.
    // AJV skips removeAdditional when required fails — dropRequired prevents that.
    const schemaWithRequired = {
      $defs: {
        StrictVar: {
          type: "object",
          additionalProperties: false,
          required: ["must_have"],
          properties: {
            schema_class: { type: "string" },
            must_have: { type: "string" },
            name: { type: "string" }
          }
        }
      }
    };
    const v = { schema_class: "StrictVar", name: "keep", orphan: "strip" };
    // 'must_have' is missing (required) — strip should still remove 'orphan'
    const result = stripExtraVariableFields(v, schemaWithRequired);
    expect(result).not.toHaveProperty("orphan");
    expect(result).toHaveProperty("name", "keep");
  });

  it("uses separate caches for different schema objects with the same class name", () => {
    const schemaA = {
      $defs: {
        MyVar: {
          type: "object",
          additionalProperties: false,
          properties: {
            schema_class: { type: "string" },
            field_a: { type: "string" }
          }
        }
      }
    };
    const schemaB = {
      $defs: {
        MyVar: {
          type: "object",
          additionalProperties: false,
          properties: {
            schema_class: { type: "string" },
            field_b: { type: "string" }
          }
        }
      }
    };

    const v = { schema_class: "MyVar", field_a: "keep", field_b: "keep" };
    const resultA = stripExtraVariableFields(v, schemaA);
    const resultB = stripExtraVariableFields(v, schemaB);

    expect(resultA).toHaveProperty("field_a");
    expect(resultA).not.toHaveProperty("field_b");
    expect(resultB).toHaveProperty("field_b");
    expect(resultB).not.toHaveProperty("field_a");
  });
});

// Guards the exact nested data-loss path the consolidated strip exists to handle,
// against the REAL bundled schema (not a synthetic one): type-specific calibration
// fields must survive for their matching variable type, and orphaned fields left
// behind by a variable-type switch must be removed.
describe("stripExtraVariableFields — real bundled schema", () => {
  const rootSchema = getBaseSchema() as unknown as JSONSchema;

  const calibrationOf = (v: Record<string, unknown>) =>
    ((v.analyzing_instrument as Record<string, unknown>)?.calibration ??
      {}) as Record<string, unknown>;

  it("preserves pH-specific calibration fields on a DiscretePHVariable", () => {
    // DiscretePHVariable -> PHInstrument -> PHCalibration, which legitimately
    // carries dye_type_and_manufacturer + ph_of_standards.
    const phVar = {
      schema_class: "DiscretePHVariable",
      long_name: "pH (total scale)",
      dataset_variable_name: "pH",
      analyzing_instrument: {
        calibration: {
          dye_type_and_manufacturer: "m-cresol purple, Sigma-Aldrich",
          ph_of_standards: "7.0, 10.0"
        }
      }
    };

    const result = stripExtraVariableFields(phVar, rootSchema);
    const cal = calibrationOf(result);

    expect(result.schema_class).toBe("DiscretePHVariable");
    expect(result.long_name).toBe("pH (total scale)");
    expect(cal.dye_type_and_manufacturer).toBe("m-cresol purple, Sigma-Aldrich");
    expect(cal.ph_of_standards).toBe("7.0, 10.0");
  });

  it("drops orphaned pH calibration fields when schema_class is DiscreteCO2Variable, keeping CO2 fields", () => {
    // Simulates switching a variable's type pH -> CO2 without re-clearing
    // calibration: the pH dye field is now orphaned (not in DiscreteCO2Calibration),
    // while standard_gas_info is valid for CO2.
    const switchedVar = {
      schema_class: "DiscreteCO2Variable",
      long_name: "xCO2",
      dataset_variable_name: "xCO2",
      analyzing_instrument: {
        calibration: {
          dye_type_and_manufacturer: "leftover from pH",
          standard_gas_info: { manufacturer: "NOAA" }
        }
      }
    };

    const result = stripExtraVariableFields(switchedVar, rootSchema);
    const cal = calibrationOf(result);

    expect(cal).not.toHaveProperty("dye_type_and_manufacturer");
    expect(cal).toHaveProperty("standard_gas_info");
    expect((cal.standard_gas_info as Record<string, unknown>).manufacturer).toBe(
      "NOAA"
    );
  });

  it("strips an unknown top-level field but keeps schema_class and known fields", () => {
    const v = {
      schema_class: "DiscretePHVariable",
      long_name: "pH",
      not_a_real_field: "remove me"
    };
    const result = stripExtraVariableFields(v, rootSchema);
    expect(result).not.toHaveProperty("not_a_real_field");
    expect(result.schema_class).toBe("DiscretePHVariable");
    expect(result.long_name).toBe("pH");
  });
});
