import { describe, it, expect } from "vitest";
import { stripExtraVariableFields } from "../variableModalConfig";

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
