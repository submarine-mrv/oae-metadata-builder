import { describe, it, expect } from "vitest";
import {
  collectFields,
  ACCORDION_CONFIG,
  normalizeFieldConfig
} from "../variableModalConfig";
import type { FieldConfig } from "../variableModalConfig";

describe("collectFields", () => {
  it("returns base fields when no groups provided", () => {
    const base = ["field_a", { path: "field_b", span: 6 }];
    const result = collectFields("basic", base);
    expect(result).toEqual(base);
  });

  it("does not mutate the base array", () => {
    const base = ["field_a"];
    collectFields("basic", base, { basic: ["field_b"] });
    expect(base).toEqual(["field_a"]);
  });

  it("appends fields from a single group", () => {
    const base = ["field_a"];
    const group = { basic: ["field_b", { path: "field_c", span: 6 }] };
    const result = collectFields("basic", base, group);
    expect(result).toEqual([
      "field_a",
      "field_b",
      { path: "field_c", span: 6 }
    ]);
  });

  it("appends fields from multiple groups in order", () => {
    const group1 = { analysis: ["g1_field"] };
    const group2 = { analysis: [{ path: "g2_field", span: 6 }] };
    const result = collectFields("analysis", ["base"], group1, group2);
    expect(result).toEqual(["base", "g1_field", { path: "g2_field", span: 6 }]);
  });

  it("skips groups that have no fields for the requested section", () => {
    const group = { sampling: ["only_in_sampling"] };
    const result = collectFields("basic", ["base"], group);
    expect(result).toEqual(["base"]);
  });

  it("handles empty base with group-only fields", () => {
    const group = { calculation: [{ path: "calc_method" }] };
    const result = collectFields("calculation", [], group);
    expect(result).toEqual([{ path: "calc_method" }]);
  });
});

describe("ACCORDION_CONFIG", () => {
  it("has all expected section keys", () => {
    const keys = ACCORDION_CONFIG.map((s) => s.key);
    expect(keys).toEqual([
      "basic",
      "sampling",
      "analysis",
      "instrument",
      "calibration",
      "calculation",
      "qc",
      "additional"
    ]);
  });

  it("every section has at least one field", () => {
    for (const section of ACCORDION_CONFIG) {
      expect(section.fields.length).toBeGreaterThan(0);
    }
  });

  it("preserves calibration field ordering: shared top → CRM → dye → shared bottom", () => {
    const cal = ACCORDION_CONFIG.find((s) => s.key === "calibration")!;
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

    // CRM fields (TA/DIC) come before dye fields (pH)
    const crmIdx = paths.indexOf(
      "analyzing_instrument.calibration.crm_manufacturer"
    );
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

    expect(techIdx).toBeLessThan(crmIdx);
    expect(locIdx).toBeLessThan(crmIdx);
    expect(crmIdx).toBeLessThan(dyeIdx);
    expect(dyeIdx).toBeLessThan(freqIdx);
    expect(freqIdx).toBeLessThan(certsIdx);
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
