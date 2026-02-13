import { describe, it, expect } from "vitest";
import {
  buildSectionFields,
  getAccordionConfig,
  VARIABLE_TYPE_LAYERS,
  VARIABLE_SCHEMA_MAP,
  normalizeFieldConfig,
  getSchemaKey
} from "../variableModalConfig";
import type { FieldConfig, HierarchyLayer } from "../variableModalConfig";

describe("buildSectionFields", () => {
  it("returns empty array when no layers contribute to the section", () => {
    const layer: HierarchyLayer = { name: "Empty", sections: {} };
    expect(buildSectionFields("basic", [layer])).toEqual([]);
  });

  it("appends fields from plain array contributions (default)", () => {
    const layer1: HierarchyLayer = {
      name: "L1",
      sections: { basic: ["field_a"] }
    };
    const layer2: HierarchyLayer = {
      name: "L2",
      sections: { basic: [{ path: "field_b", span: 6 }] }
    };
    const result = buildSectionFields("basic", [layer1, layer2]);
    expect(result).toEqual(["field_a", { path: "field_b", span: 6 }]);
  });

  it("prepends fields when position is 'prepend'", () => {
    const base: HierarchyLayer = {
      name: "Base",
      sections: { analysis: ["base_field"] }
    };
    const prepended: HierarchyLayer = {
      name: "Prepend",
      sections: {
        analysis: { fields: ["prepend_field"], position: "prepend" }
      }
    };
    const result = buildSectionFields("analysis", [base, prepended]);
    expect(result).toEqual(["prepend_field", "base_field"]);
  });

  it("inserts fields after a named field", () => {
    const base: HierarchyLayer = {
      name: "Base",
      sections: { calibration: ["top", "anchor", "bottom"] }
    };
    const inserter: HierarchyLayer = {
      name: "Inserter",
      sections: {
        calibration: {
          fields: ["inserted_a", "inserted_b"],
          position: { after: "anchor" }
        }
      }
    };
    const result = buildSectionFields("calibration", [base, inserter]);
    expect(result).toEqual([
      "top",
      "anchor",
      "inserted_a",
      "inserted_b",
      "bottom"
    ]);
  });

  it("falls back to append when { after } target is not found", () => {
    const base: HierarchyLayer = {
      name: "Base",
      sections: { basic: ["field_a"] }
    };
    const inserter: HierarchyLayer = {
      name: "Inserter",
      sections: {
        basic: { fields: ["orphan"], position: { after: "nonexistent" } }
      }
    };
    const result = buildSectionFields("basic", [base, inserter]);
    expect(result).toEqual(["field_a", "orphan"]);
  });

  it("handles multiple { after } inserts at the same anchor", () => {
    const base: HierarchyLayer = {
      name: "Base",
      sections: { calibration: ["top", "anchor", "bottom"] }
    };
    const first: HierarchyLayer = {
      name: "First",
      sections: {
        calibration: { fields: ["first_insert"], position: { after: "anchor" } }
      }
    };
    const second: HierarchyLayer = {
      name: "Second",
      sections: {
        calibration: { fields: ["second_insert"], position: { after: "anchor" } }
      }
    };
    // Second inserts after "anchor", which pushes it between anchor and first_insert
    const result = buildSectionFields("calibration", [base, first, second]);
    expect(result).toEqual([
      "top",
      "anchor",
      "second_insert",
      "first_insert",
      "bottom"
    ]);
  });

  it("skips layers that have no contribution for the requested section", () => {
    const layer: HierarchyLayer = {
      name: "Other",
      sections: { sampling: ["only_in_sampling"] }
    };
    expect(buildSectionFields("basic", [layer])).toEqual([]);
  });

  it("skips layers with empty field arrays", () => {
    const base: HierarchyLayer = {
      name: "Base",
      sections: { basic: ["field_a"] }
    };
    const empty: HierarchyLayer = {
      name: "Empty",
      sections: { basic: [] }
    };
    expect(buildSectionFields("basic", [base, empty])).toEqual(["field_a"]);
  });

  it("does not mutate layer definitions", () => {
    const fields = ["field_a"];
    const layer: HierarchyLayer = {
      name: "L",
      sections: { basic: fields }
    };
    buildSectionFields("basic", [layer]);
    expect(fields).toEqual(["field_a"]);
  });
});

describe("getAccordionConfig", () => {
  it("returns correct section keys for DiscretePHVariable", () => {
    const sections = getAccordionConfig("DiscretePHVariable");
    const keys = sections.map((s) => s.key);
    expect(keys).toEqual([
      "basic",
      "sampling",
      "analysis",
      "instrument",
      "calibration",
      "qc",
      "additional"
    ]);
  });

  it("returns empty array for unknown schema key", () => {
    expect(getAccordionConfig("NonexistentVariable")).toEqual([]);
  });

  it("excludes sections with no fields (CalculatedVariable has no calibration)", () => {
    const sections = getAccordionConfig("CalculatedVariable");
    const keys = sections.map((s) => s.key);
    expect(keys).not.toContain("calibration");
    expect(keys).toContain("calculation");
  });

  it("preserves calibration field ordering for pH: shared top → dye → shared bottom", () => {
    const sections = getAccordionConfig("DiscretePHVariable");
    const cal = sections.find((s) => s.key === "calibration")!;
    const paths = cal.fields.map((f) =>
      typeof f === "string" ? f : (f as FieldConfig).path
    );

    // Shared top fields come first
    const techIdx = paths.indexOf(
      "analyzing_instrument.calibration.technique_description"
    );
    const locIdx = paths.indexOf(
      "analyzing_instrument.calibration.calibration_location"
    );

    // Dye fields (pH-specific) come after location
    const dyeIdx = paths.indexOf(
      "analyzing_instrument.calibration.dye_type_and_manufacturer"
    );

    // Shared bottom fields come last
    const freqIdx = paths.indexOf(
      "analyzing_instrument.calibration.frequency"
    );
    const certsIdx = paths.indexOf(
      "analyzing_instrument.calibration.calibration_certificates"
    );

    expect(techIdx).toBeLessThan(dyeIdx);
    expect(locIdx).toBeLessThan(dyeIdx);
    expect(dyeIdx).toBeLessThan(freqIdx);
    expect(freqIdx).toBeLessThan(certsIdx);
  });

  it("includes calibration_temperature in both pH and CO2 configs", () => {
    for (const schemaKey of ["DiscretePHVariable", "DiscreteCO2Variable"]) {
      const sections = getAccordionConfig(schemaKey);
      const cal = sections.find((s) => s.key === "calibration")!;
      const paths = cal.fields.map((f) =>
        typeof f === "string" ? f : (f as FieldConfig).path
      );
      expect(paths).toContain(
        "analyzing_instrument.calibration.calibration_temperature"
      );
    }
  });

  it("does not include pH-specific fields in sediment config", () => {
    const sections = getAccordionConfig("DiscreteSedimentVariable");
    const cal = sections.find((s) => s.key === "calibration")!;
    const paths = cal.fields.map((f) =>
      typeof f === "string" ? f : (f as FieldConfig).path
    );
    expect(paths).not.toContain(
      "analyzing_instrument.calibration.dye_type_and_manufacturer"
    );
    expect(paths).not.toContain(
      "analyzing_instrument.calibration.calibration_temperature"
    );
  });

  it("NonMeasuredVariable has no calibration, instrument, or calculation sections", () => {
    const sections = getAccordionConfig("NonMeasuredVariable");
    const keys = sections.map((s) => s.key);
    expect(keys).not.toContain("calibration");
    expect(keys).not.toContain("calculation");
    // NonMeasuredVariable has BASE which includes instrument fields
    expect(keys).toContain("instrument");
  });
});

describe("VARIABLE_TYPE_LAYERS", () => {
  it("has an entry for every schema key in VARIABLE_SCHEMA_MAP", () => {
    const allSchemaKeys = new Set<string>();
    for (const typeMap of Object.values(VARIABLE_SCHEMA_MAP)) {
      for (const [key, value] of Object.entries(typeMap)) {
        if (key === "placeholderOverrides") continue;
        if (typeof value === "string") {
          allSchemaKeys.add(value);
        } else {
          for (const schemaKey of Object.values(value as Record<string, string>)) {
            allSchemaKeys.add(schemaKey);
          }
        }
      }
    }
    for (const schemaKey of allSchemaKeys) {
      expect(VARIABLE_TYPE_LAYERS).toHaveProperty(schemaKey);
    }
  });

  it("every layer stack starts with BASE (has basic section)", () => {
    for (const [key, layers] of Object.entries(VARIABLE_TYPE_LAYERS)) {
      const basicFields = buildSectionFields("basic", layers);
      expect(
        basicFields.length,
        `${key} should have basic fields from BASE layer`
      ).toBeGreaterThan(0);
    }
  });

  it("discrete types include calibration fields", () => {
    const discreteKeys = [
      "DiscretePHVariable",
      "DiscreteTAVariable",
      "DiscreteDICVariable",
      "DiscreteSedimentVariable",
      "DiscreteCO2Variable",
      "HPLCVariable",
      "DiscreteMeasuredVariable"
    ];
    for (const key of discreteKeys) {
      const calFields = buildSectionFields(
        "calibration",
        VARIABLE_TYPE_LAYERS[key]
      );
      expect(
        calFields.length,
        `${key} should have calibration fields`
      ).toBeGreaterThan(0);
    }
  });

  it("continuous types include analysis fields from CONTINUOUS layer", () => {
    const continuousKeys = [
      "ContinuousPHVariable",
      "ContinuousTAVariable",
      "ContinuousDICVariable",
      "ContinuousSedimentVariable",
      "ContinuousMeasuredVariable"
    ];
    for (const key of continuousKeys) {
      const analysisFields = buildSectionFields(
        "analysis",
        VARIABLE_TYPE_LAYERS[key]
      );
      const paths = analysisFields.map((f) =>
        typeof f === "string" ? f : f.path
      );
      expect(paths).toContain("raw_data_calculation_method");
    }
  });

  it("calculated type includes calculation section", () => {
    const calcFields = buildSectionFields(
      "calculation",
      VARIABLE_TYPE_LAYERS["CalculatedVariable"]
    );
    const paths = calcFields.map((f) =>
      typeof f === "string" ? f : f.path
    );
    expect(paths).toContain("calculation_method_and_parameters");
  });

  it("NonMeasuredVariable has only BASE layer fields", () => {
    const layers = VARIABLE_TYPE_LAYERS["NonMeasuredVariable"];
    expect(layers).toHaveLength(1);
    // No calibration, instrument, or calculation sections
    expect(buildSectionFields("calibration", layers)).toEqual([]);
    expect(buildSectionFields("calculation", layers)).toEqual([]);
  });
});

describe("getSchemaKey", () => {
  it("returns null when variableType or genesis is missing", () => {
    expect(getSchemaKey(undefined, undefined, undefined)).toBeNull();
    expect(getSchemaKey("pH", undefined, undefined)).toBeNull();
    expect(getSchemaKey(undefined, "measured", "discrete")).toBeNull();
  });

  it("returns schema key for each variable type (discrete measured)", () => {
    expect(getSchemaKey("pH", "measured", "discrete")).toBe("DiscretePHVariable");
    expect(getSchemaKey("ta", "measured", "discrete")).toBe("DiscreteTAVariable");
    expect(getSchemaKey("dic", "measured", "discrete")).toBe("DiscreteDICVariable");
    expect(getSchemaKey("sediment", "measured", "discrete")).toBe("DiscreteSedimentVariable");
    expect(getSchemaKey("co2", "measured", "discrete")).toBe("DiscreteCO2Variable");
    expect(getSchemaKey("observed_property", "measured", "discrete")).toBe("DiscreteMeasuredVariable");
  });

  it("returns CalculatedVariable for all calculated types", () => {
    expect(getSchemaKey("pH", "calculated", undefined)).toBe("CalculatedVariable");
    expect(getSchemaKey("ta", "calculated", undefined)).toBe("CalculatedVariable");
    expect(getSchemaKey("co2", "calculated", undefined)).toBe("CalculatedVariable");
  });

  it("returns null for co2 + measured + continuous (no continuous variant)", () => {
    expect(getSchemaKey("co2", "measured", "continuous")).toBeNull();
  });

  it("returns schema key for continuous variants that exist", () => {
    expect(getSchemaKey("pH", "measured", "continuous")).toBe("ContinuousPHVariable");
    expect(getSchemaKey("ta", "measured", "continuous")).toBe("ContinuousTAVariable");
  });

  it("returns HPLCVariable for hplc + measured + discrete", () => {
    expect(getSchemaKey("hplc", "measured", "discrete")).toBe("HPLCVariable");
  });

  it("returns NonMeasuredVariable for non_measured (DIRECT, no genesis needed)", () => {
    expect(getSchemaKey("non_measured", undefined, undefined)).toBe("NonMeasuredVariable");
  });

  it("returns null for non_measured when genesis is provided (DIRECT rejects explicit genesis)", () => {
    expect(getSchemaKey("non_measured", "measured", "discrete")).toBeNull();
    expect(getSchemaKey("non_measured", "calculated", undefined)).toBeNull();
  });

  it("returns null for unknown variable type", () => {
    expect(getSchemaKey("unknown", "measured", "discrete")).toBeNull();
  });

  it("returns null for hplc with unsupported genesis/sampling", () => {
    expect(getSchemaKey("hplc", "measured", "continuous")).toBeNull();
    expect(getSchemaKey("hplc", "calculated", undefined)).toBeNull();
  });
});

describe("normalizeFieldConfig", () => {
  it("converts a string to a full FieldConfig", () => {
    const result = normalizeFieldConfig("my_field");
    expect(result).toEqual({
      path: "my_field",
      span: 12,
      inputType: "text",
      descriptionModal: false,
      placeholderText: undefined,
      rows: undefined,
      gateLabel: undefined,
      newRowAfter: false
    });
  });

  it("fills defaults for partial FieldConfig", () => {
    const result = normalizeFieldConfig({ path: "x", span: 6 });
    expect(result.span).toBe(6);
    expect(result.inputType).toBe("text");
    expect(result.newRowAfter).toBe(false);
  });
});
