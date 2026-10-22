import { describe, expect, it } from "vitest";
import { hasValue, isFieldRequired, type JSONSchema } from "../schemaUtils";

// A required instrument whose calibration is a discriminated union, plus an optional `extra`.
const rootSchema = {
  $defs: {
    Variable: {
      type: "object",
      properties: {
        instrument: { $ref: "#/$defs/Instrument" },
        extra: { $ref: "#/$defs/Extra" },
      },
      required: ["instrument"],
    },
    Instrument: {
      type: "object",
      properties: {
        calibration: {
          oneOf: [{ $ref: "#/$defs/CalA" }, { $ref: "#/$defs/CalB" }],
          discriminator: { propertyName: "kind" },
        },
      },
      required: ["calibration"],
    },
    CalA: {
      type: "object",
      properties: { kind: { enum: ["a"] }, shared: {}, a_required: {} },
      required: ["kind", "shared", "a_required"],
    },
    CalB: {
      type: "object",
      properties: { kind: { enum: ["b", "other"] }, shared: {}, a_required: {}, kind_custom: {} },
      required: ["kind", "shared"],
      if: { properties: { kind: { const: "other" } }, required: ["kind"] },
      // biome-ignore lint/suspicious/noThenProperty: JSON Schema "then" keyword, not a PromiseLike
      then: { required: ["kind_custom"] },
    },
    Extra: {
      type: "object",
      properties: { detail: {}, note: {} },
      required: ["detail"],
    },
  },
} as unknown as JSONSchema;

const variable = rootSchema.$defs?.Variable as JSONSchema;
const required = (path: string, formData?: Record<string, unknown>) =>
  isFieldRequired(path, variable, rootSchema, formData);
const withKind = (kind: string) => ({ instrument: { calibration: { kind } } });

describe("isFieldRequired", () => {
  it("requires a field only when every union branch that defines it requires it", () => {
    expect(required("instrument.calibration.shared", {})).toBe(true);
    expect(required("instrument.calibration.a_required", {})).toBe(false);
  });

  it("uses the selected branch's required list once the discriminator is set", () => {
    expect(required("instrument.calibration.a_required", withKind("a"))).toBe(true);
    expect(required("instrument.calibration.a_required", withKind("b"))).toBe(false);
  });

  it("applies if/then rules against the current data", () => {
    expect(required("instrument.calibration.kind_custom", {})).toBe(false);
    expect(required("instrument.calibration.kind_custom", withKind("b"))).toBe(false);
    expect(required("instrument.calibration.kind_custom", withKind("other"))).toBe(true);
  });

  it("ignores required fields under an optional object until it has data", () => {
    expect(required("extra.detail", {})).toBe(false);
    expect(required("extra.detail", { extra: { note: "" } })).toBe(false);
    expect(required("extra.detail", { extra: { note: "x" } })).toBe(true);
  });

  it("ignores ancestors when no form data is given", () => {
    expect(required("extra.detail")).toBe(true);
  });
});

describe("hasValue", () => {
  it("treats empty strings, arrays and objects as unfilled", () => {
    expect(hasValue({ a: "", b: [], c: { d: undefined } })).toBe(false);
    expect(hasValue({ a: { b: false } })).toBe(true);
    expect(hasValue(0)).toBe(true);
  });
});
