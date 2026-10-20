import { describe, expect, it } from "vitest";
import bundled from "@/schema/schema.bundled.json";
import { hasValue, isFieldRequired, type JSONSchema, resolveRef } from "../schemaUtils";

const rootSchema = bundled as unknown as JSONSchema;
const variable = (cls: string) => resolveRef({ $ref: `#/$defs/${cls}` }, rootSchema);
const cal = (field: string) => `analyzing_instrument.calibration.${field}`;

describe("isFieldRequired", () => {
  it("requires fields that every pH calibration class requires", () => {
    const ph = variable("DiscretePHVariable");
    expect(isFieldRequired(cal("technique_description"), ph, rootSchema, {})).toBe(true);
    expect(isFieldRequired(cal("standard_used"), ph, rootSchema, {})).toBe(true);
  });

  it("leaves fields optional when only one pH calibration class has them", () => {
    const ph = variable("DiscretePHVariable");
    expect(isFieldRequired(cal("dye_purified"), ph, rootSchema, {})).toBe(false);
  });

  it("requires calibration fields of a required calibration with no data yet", () => {
    const ta = variable("DiscreteTAVariable");
    expect(isFieldRequired(cal("crm_manufacturer"), ta, rootSchema, {})).toBe(true);
  });

  it("requires fields under an optional calibration only once it has data", () => {
    const generic = variable("DiscreteMeasuredVariable");
    const path = cal("technique_description");
    expect(isFieldRequired(path, generic, rootSchema, {})).toBe(false);
    expect(
      isFieldRequired(path, generic, rootSchema, {
        analyzing_instrument: { calibration: { frequency: "" } },
      }),
    ).toBe(false);
    expect(
      isFieldRequired(path, generic, rootSchema, {
        analyzing_instrument: { calibration: { frequency: "weekly" } },
      }),
    ).toBe(true);
  });

  it("ignores ancestors when no form data is given", () => {
    const generic = variable("DiscreteMeasuredVariable");
    expect(isFieldRequired(cal("technique_description"), generic, rootSchema)).toBe(true);
  });
});

describe("hasValue", () => {
  it("treats empty strings, arrays and objects as unfilled", () => {
    expect(hasValue({ a: "", b: [], c: { d: undefined } })).toBe(false);
    expect(hasValue({ a: { b: false } })).toBe(true);
    expect(hasValue(0)).toBe(true);
  });
});
