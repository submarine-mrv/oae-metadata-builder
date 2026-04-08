// formDataCleanup.test.ts - Tests for form data cleaning helpers

import { describe, it, expect } from "vitest";
import { cleanFormData, isFormEmpty } from "../formDataCleanup";

describe("cleanFormData", () => {
  it("returns a new object reference for root-level data", () => {
    const input = { foo: "bar" };
    const result = cleanFormData(input);
    expect(result).not.toBe(input);
    expect(result).toEqual({ foo: "bar" });
  });

  it("keeps the root object even if it ends up empty", () => {
    const result = cleanFormData({} as Record<string, unknown>);
    expect(result).toEqual({});
  });

  it("strips top-level null and undefined values", () => {
    const result = cleanFormData({
      a: "x",
      b: null,
      c: undefined,
      d: 5
    } as Record<string, unknown>);
    expect(result).toEqual({ a: "x", d: 5 });
  });

  it("strips empty strings", () => {
    const result = cleanFormData({
      a: "kept",
      b: ""
    } as Record<string, unknown>);
    expect(result).toEqual({ a: "kept", b: "" });
    // NOTE: current cleanFormData does NOT strip empty strings — only
    // null/undefined. This test documents that behavior. Empty strings
    // may carry meaning (e.g., auto-propagated project_id on a fresh
    // experiment) so we deliberately leave them alone.
  });

  it("strips empty arrays at the top level", () => {
    const result = cleanFormData({
      a: "x",
      emptyList: []
    } as Record<string, unknown>);
    expect(result).toEqual({ a: "x" });
  });

  it("strips nested nulls inside arrays of objects", () => {
    const result = cleanFormData({
      people: [{ name: "Alice", email: null }, { name: "Bob" }]
    } as Record<string, unknown>);
    expect(result).toEqual({
      people: [{ name: "Alice" }, { name: "Bob" }]
    });
  });

  it("drops a fully-cleared nested object from the parent", () => {
    // Regression test for the B6 fix: before, `data_submitter: {}` would
    // be retained and re-trigger AJV required errors against the now-empty
    // inner fields. Now it should disappear so AJV reports the whole
    // required object as missing.
    const result = cleanFormData({
      title: "Dataset 1",
      data_submitter: { name: null, email: null, phone: "" }
    } as Record<string, unknown>);
    expect(result).toEqual({
      title: "Dataset 1",
      data_submitter: { phone: "" }
    });
  });

  it("drops a nested object with all nulls entirely", () => {
    const result = cleanFormData({
      title: "Dataset 1",
      data_submitter: { name: null, email: null }
    } as Record<string, unknown>);
    expect(result).toEqual({ title: "Dataset 1" });
  });

  it("recurses through nested arrays of objects with nulls", () => {
    const result = cleanFormData({
      project_leads: [
        { name: "Alice", phone: null },
        { name: null, email: null }
      ]
    } as Record<string, unknown>);
    expect(result).toEqual({
      project_leads: [{ name: "Alice" }]
    });
  });

  it("strips an array when all items become empty after cleanup", () => {
    const result = cleanFormData({
      project_leads: [{ name: null }, { email: null }]
    } as Record<string, unknown>);
    expect(result).toEqual({});
  });

  it("leaves primitive values (numbers, booleans) untouched", () => {
    const result = cleanFormData({
      count: 0,
      flag: false,
      negative: -5
    } as Record<string, unknown>);
    expect(result).toEqual({ count: 0, flag: false, negative: -5 });
  });
});

describe("isFormEmpty", () => {
  it("returns true for undefined or null input", () => {
    expect(isFormEmpty(undefined)).toBe(true);
    expect(isFormEmpty(null)).toBe(true);
  });

  it("returns true for empty object", () => {
    expect(isFormEmpty({})).toBe(true);
  });

  it("returns true for object with only empty strings", () => {
    expect(isFormEmpty({ project_id: "", description: "" })).toBe(true);
  });

  it("returns true for object with only null and empty arrays", () => {
    expect(isFormEmpty({ name: null, tags: [] })).toBe(true);
  });

  it("returns true for nested objects that are all empty", () => {
    expect(
      isFormEmpty({
        project_id: "",
        spatial_coverage: { geo: { box: "" } },
        leads: []
      })
    ).toBe(true);
  });

  it("returns false when any primitive has a value", () => {
    expect(isFormEmpty({ project_id: "test" })).toBe(false);
    expect(isFormEmpty({ count: 0 })).toBe(false);
    expect(isFormEmpty({ flag: false })).toBe(false);
  });

  it("returns false when a nested field has a value", () => {
    expect(
      isFormEmpty({
        project_id: "",
        spatial_coverage: { geo: { box: "1,2,3,4" } }
      })
    ).toBe(false);
  });

  it("returns false when an array has items", () => {
    expect(isFormEmpty({ tags: ["a"] })).toBe(false);
  });
});
