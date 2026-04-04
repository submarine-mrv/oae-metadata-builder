import { describe, it, expect } from "vitest";
import { normalizeVariableFields } from "../variableModalConfig";

describe("normalizeVariableFields", () => {
  it("returns unchanged when all fields are consistent", () => {
    const v = {
      schema_class: "DiscretePHVariable",
      variable_type: "pH",
      genesis: "measured",
      sampling: "discrete"
    };
    expect(normalizeVariableFields(v)).toEqual(v);
  });

  it("returns unchanged when schema_class is missing", () => {
    const v = { variable_type: "pH", genesis: "measured" };
    expect(normalizeVariableFields(v)).toBe(v);
  });

  it("fixes wrong variable_type", () => {
    const v = {
      schema_class: "DiscretePHVariable",
      variable_type: "ta",
      genesis: "measured",
      sampling: "discrete"
    };
    expect(normalizeVariableFields(v)).toMatchObject({
      variable_type: "pH"
    });
  });

  it("fixes wrong genesis", () => {
    const v = {
      schema_class: "DiscretePHVariable",
      variable_type: "pH",
      genesis: "calculated",
      sampling: "discrete"
    };
    expect(normalizeVariableFields(v)).toMatchObject({
      genesis: "measured"
    });
  });

  it("fixes wrong sampling", () => {
    const v = {
      schema_class: "DiscretePHVariable",
      variable_type: "pH",
      genesis: "measured",
      sampling: "continuous"
    };
    expect(normalizeVariableFields(v)).toMatchObject({
      sampling: "discrete"
    });
  });

  it("clears genesis and sampling for NonMeasuredVariable", () => {
    const v = {
      schema_class: "NonMeasuredVariable",
      variable_type: "other",
      genesis: "measured",
      sampling: "discrete"
    };
    const result = normalizeVariableFields(v);
    expect(result.variable_type).toBe("non_measured");
    expect(result.genesis).toBeUndefined();
    expect(result.sampling).toBeUndefined();
  });

  it("clears sampling for CalculatedVariable", () => {
    const v = {
      schema_class: "CalculatedVariable",
      variable_type: "pH",
      genesis: "measured",
      sampling: "discrete"
    };
    const result = normalizeVariableFields(v);
    expect(result.variable_type).toBe("pH"); // trusted
    expect(result.genesis).toBe("calculated");
    expect(result.sampling).toBeUndefined();
  });

  it("trusts variable_type for CalculatedVariable (shared class)", () => {
    const v = {
      schema_class: "CalculatedVariable",
      variable_type: "dic",
      genesis: "calculated"
    };
    const result = normalizeVariableFields(v);
    expect(result.variable_type).toBe("dic"); // kept
  });

  it("defaults CalculatedVariable variable_type to 'other' if non_measured", () => {
    const v = {
      schema_class: "CalculatedVariable",
      variable_type: "non_measured",
      genesis: "calculated"
    };
    const result = normalizeVariableFields(v);
    expect(result.variable_type).toBe("other");
  });

  it("coerces invalid variable_type for CalculatedVariable to 'other'", () => {
    const v = {
      schema_class: "CalculatedVariable",
      variable_type: "typo_value",
      genesis: "calculated"
    };
    const result = normalizeVariableFields(v);
    expect(result.variable_type).toBe("other");
  });

  it("coerces measured-only variable_type for CalculatedVariable to 'other'", () => {
    const v = {
      schema_class: "CalculatedVariable",
      variable_type: "hplc",
      genesis: "calculated"
    };
    const result = normalizeVariableFields(v);
    expect(result.variable_type).toBe("other");
  });

  it("fills missing fields from schema_class", () => {
    const v = {
      schema_class: "ContinuousTAVariable",
      dataset_variable_name: "ta"
    };
    const result = normalizeVariableFields(v);
    expect(result.variable_type).toBe("ta");
    expect(result.genesis).toBe("measured");
    expect(result.sampling).toBe("continuous");
  });

  it("derives schema_class from variable_type + genesis + sampling when missing", () => {
    const v = {
      variable_type: "pH",
      genesis: "measured",
      sampling: "discrete",
      dataset_variable_name: "pH_total"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("DiscretePHVariable");
  });

  it("derives schema_class for calculated variables when missing", () => {
    const v = {
      variable_type: "ta",
      genesis: "calculated",
      dataset_variable_name: "ta_calc"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("CalculatedVariable");
  });

  it("derives schema_class for non_measured when missing", () => {
    const v = {
      variable_type: "non_measured",
      dataset_variable_name: "expocode"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("NonMeasuredVariable");
  });

  it("returns unchanged when neither schema_class nor variable_type present", () => {
    const v = { dataset_variable_name: "unknown" };
    expect(normalizeVariableFields(v)).toBe(v);
  });

  it("handles null input gracefully", () => {
    expect(normalizeVariableFields(null as unknown as Record<string, unknown>)).toBeNull();
  });

  it("handles non-object input gracefully", () => {
    expect(normalizeVariableFields("string" as unknown as Record<string, unknown>)).toBe("string");
    expect(normalizeVariableFields(42 as unknown as Record<string, unknown>)).toBe(42);
  });

  it("handles array input gracefully", () => {
    const arr = [1, 2, 3];
    expect(normalizeVariableFields(arr as unknown as Record<string, unknown>)).toBe(arr);
  });

  it("strips _-prefixed legacy UI fields", () => {
    const v = {
      _schemaKey: "DiscretePHVariable",
      _variableType: "pH",
      schema_class: "DiscretePHVariable",
      variable_type: "pH",
      genesis: "measured",
      sampling: "discrete",
      dataset_variable_name: "pH_total"
    };
    const result = normalizeVariableFields(v);
    expect(result._schemaKey).toBeUndefined();
    expect(result._variableType).toBeUndefined();
    expect(result.schema_class).toBe("DiscretePHVariable");
    expect(result.variable_type).toBe("pH");
  });

  it("re-derives schema_class when it is unknown (e.g., abstract class)", () => {
    const v = {
      schema_class: "InSituVariable",
      variable_type: "other",
      genesis: "measured",
      sampling: "continuous",
      dataset_variable_name: "Temperature"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("ContinuousMeasuredVariable");
  });

  it("re-derives schema_class for unknown class with non_measured type", () => {
    const v = {
      schema_class: "MeasuredVariable",
      variable_type: "non_measured",
      dataset_variable_name: "Cruise_ID"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("NonMeasuredVariable");
  });

  it("fixes sibling fields after deriving schema_class from missing", () => {
    const v = {
      variable_type: "ta",
      genesis: "calculated",
      sampling: "discrete", // stale — CalculatedVariable has no sampling
      dataset_variable_name: "ta_calc"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("CalculatedVariable");
    expect(result.sampling).toBeUndefined();
  });

  it("derives non_measured with stale genesis and clears siblings", () => {
    const v = {
      variable_type: "non_measured",
      genesis: "measured",
      sampling: "discrete",
      dataset_variable_name: "Cruise_ID"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("NonMeasuredVariable");
    expect(result.variable_type).toBe("non_measured");
    expect(result.genesis).toBeUndefined();
    expect(result.sampling).toBeUndefined();
  });

  it("fixes sibling fields after re-deriving schema_class from unknown", () => {
    const v = {
      schema_class: "InSituVariable",
      variable_type: "other",
      genesis: "measured",
      sampling: "continuous",
      dataset_variable_name: "Temperature"
    };
    const result = normalizeVariableFields(v);
    expect(result.schema_class).toBe("ContinuousMeasuredVariable");
    expect(result.variable_type).toBe("other");
    expect(result.genesis).toBe("measured");
    expect(result.sampling).toBe("continuous");
  });

  it("returns unchanged when schema_class is unknown and siblings cannot derive", () => {
    const v = {
      schema_class: "BogusClass",
      dataset_variable_name: "mystery"
    };
    expect(normalizeVariableFields(v)).toBe(v);
  });
});
