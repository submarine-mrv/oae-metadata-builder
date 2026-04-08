// completionCalculator.test.ts - Tests for schema-driven completion

import { describe, it, expect } from "vitest";
import {
  computeCompletion,
  countMissingRequiredFields,
  countTotalRequiredFields
} from "../completionCalculator";
import type { RJSFSchema } from "@rjsf/utils";

// A tiny fake schema just for testing the walker — no dependency on the
// actual bundled OAE schema.
const SIMPLE_SCHEMA: RJSFSchema = {
  type: "object",
  required: ["name", "email", "tags"],
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    optional_note: { type: "string" }
  }
};

const NESTED_SCHEMA: RJSFSchema = {
  type: "object",
  required: ["title", "contact"],
  properties: {
    title: { type: "string" },
    contact: {
      type: "object",
      required: ["name", "email"],
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" }
      }
    }
  }
};

describe("countTotalRequiredFields / countMissingRequiredFields", () => {
  it("counts top-level required fields", () => {
    expect(countTotalRequiredFields({}, SIMPLE_SCHEMA)).toBe(3);
    expect(countMissingRequiredFields({}, SIMPLE_SCHEMA)).toBe(3);
  });

  it("missing goes to 0 when all required fields are filled", () => {
    const data = { name: "Alice", email: "a@b.com", tags: ["x"] };
    expect(countTotalRequiredFields(data, SIMPLE_SCHEMA)).toBe(3);
    expect(countMissingRequiredFields(data, SIMPLE_SCHEMA)).toBe(0);
  });

  it("empty string counts as missing", () => {
    const data = { name: "", email: "a@b.com", tags: ["x"] };
    expect(countMissingRequiredFields(data, SIMPLE_SCHEMA)).toBe(1);
  });

  it("empty array counts as missing", () => {
    const data = { name: "Alice", email: "a@b.com", tags: [] };
    expect(countMissingRequiredFields(data, SIMPLE_SCHEMA)).toBe(1);
  });

  it("skipFields exclude fields from both total and missing", () => {
    const data = { name: "Alice" };
    expect(
      countTotalRequiredFields(data, SIMPLE_SCHEMA, ["email", "tags"])
    ).toBe(1);
    expect(
      countMissingRequiredFields(data, SIMPLE_SCHEMA, ["email", "tags"])
    ).toBe(0);
  });

  it("recurses into a present required object", () => {
    const data = { title: "T", contact: { name: "Alice" } };
    // title (1) + contact.name (1) + contact.email (1) = 3 total
    expect(countTotalRequiredFields(data, NESTED_SCHEMA)).toBe(3);
    // contact.email is missing = 1
    expect(countMissingRequiredFields(data, NESTED_SCHEMA)).toBe(1);
  });

  it("counts an absent required object as 1 missing (not its inner count)", () => {
    const data = { title: "T" };
    // title (1) + contact (1 missing parent) = 2 total
    expect(countTotalRequiredFields(data, NESTED_SCHEMA)).toBe(2);
    expect(countMissingRequiredFields(data, NESTED_SCHEMA)).toBe(1);
  });

  it("primitive array: non-empty counts as filled regardless of length", () => {
    const data = { name: "A", email: "a@b", tags: ["x", "y", "z"] };
    // tags still contributes 1 total (not 3)
    expect(countTotalRequiredFields(data, SIMPLE_SCHEMA)).toBe(3);
    expect(countMissingRequiredFields(data, SIMPLE_SCHEMA)).toBe(0);
  });

  it("object array: recurses into each item and sums inner required fields", () => {
    const schema: RJSFSchema = {
      type: "object",
      required: ["leads"],
      properties: {
        leads: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "email"],
            properties: {
              name: { type: "string" },
              email: { type: "string" }
            }
          }
        }
      }
    };
    // Two shells = 4 total, 4 missing
    expect(countTotalRequiredFields({ leads: [{}, {}] }, schema)).toBe(4);
    expect(countMissingRequiredFields({ leads: [{}, {}] }, schema)).toBe(4);

    // One complete, one half = 4 total, 1 missing
    const data = {
      leads: [{ name: "Alice", email: "a@b" }, { name: "Bob" }]
    };
    expect(countTotalRequiredFields(data, schema)).toBe(4);
    expect(countMissingRequiredFields(data, schema)).toBe(1);

    // Empty array = 1 total, 1 missing
    expect(countTotalRequiredFields({ leads: [] }, schema)).toBe(1);
    expect(countMissingRequiredFields({ leads: [] }, schema)).toBe(1);
  });

  it("returns 0 for an empty schema with no required fields", () => {
    expect(countTotalRequiredFields({}, { type: "object" })).toBe(0);
    expect(countMissingRequiredFields({}, { type: "object" })).toBe(0);
  });
});

describe("computeCompletion", () => {
  it("returns 100% for a fully filled form with no errors", () => {
    const data = { name: "Alice", email: "a@b.com", tags: ["x"] };
    const result = computeCompletion(data, SIMPLE_SCHEMA, []);
    expect(result).toEqual({ total: 3, filled: 3, percentage: 100 });
  });

  it("reflects missing required fields in the percentage", () => {
    const data = { name: "Alice" };
    const result = computeCompletion(data, SIMPLE_SCHEMA, []);
    // 1 of 3 filled
    expect(result.total).toBe(3);
    expect(result.filled).toBe(1);
    expect(result.percentage).toBe(33);
  });

  it("subtracts non-required errors from filled", () => {
    // All required filled, but 1 format error on the side
    const data = { name: "Alice", email: "not-an-email", tags: ["x"] };
    const errors = [
      {
        name: "format",
        property: ".email",
        message: "must match format \"email\"",
        params: {},
        stack: ".email must match format \"email\"",
        schemaPath: "#/properties/email/format"
      }
    ];
    const result = computeCompletion(data, SIMPLE_SCHEMA, errors);
    // 3 total - 0 missing - 1 error = 2 filled
    expect(result.total).toBe(3);
    expect(result.filled).toBe(2);
    expect(result.percentage).toBe(67);
  });

  it("ignores 'required' errors (already counted via the schema walk)", () => {
    const data = { name: "Alice" };
    const errors = [
      {
        name: "required",
        property: ".email",
        message: "Field is required",
        params: { missingProperty: "email" },
        stack: ".email required",
        schemaPath: "#/required"
      }
    ];
    const result = computeCompletion(data, SIMPLE_SCHEMA, errors);
    // 3 total, 2 missing (email, tags), 0 other errors → 1 filled → 33%
    expect(result.percentage).toBe(33);
  });

  it("does not go below 0% when errors exceed filled", () => {
    const data = { name: "Alice", email: "x", tags: ["x"] };
    const manyErrors = Array.from({ length: 10 }, (_, i) => ({
      name: "format",
      property: `.x${i}`,
      message: "bad",
      params: {},
      stack: "",
      schemaPath: ""
    }));
    const result = computeCompletion(data, SIMPLE_SCHEMA, manyErrors);
    expect(result.filled).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("returns 100% when the schema has no required fields", () => {
    const result = computeCompletion(
      {},
      { type: "object", properties: {} },
      []
    );
    expect(result.total).toBe(0);
    expect(result.percentage).toBe(100);
  });

  it("supports skipFields (e.g. variables on datasets)", () => {
    const data = { name: "Alice" };
    const result = computeCompletion(data, SIMPLE_SCHEMA, [], ["tags"]);
    // Only name and email count; name filled, email missing
    expect(result.total).toBe(2);
    expect(result.filled).toBe(1);
    expect(result.percentage).toBe(50);
  });

  it("adds extra totals (used by datasets for per-variable counts)", () => {
    const data = { name: "Alice", email: "a@b.com", tags: ["x"] };
    const result = computeCompletion(data, SIMPLE_SCHEMA, [], undefined, {
      total: 5,
      missing: 2
    });
    // 3 schema + 5 extra = 8 total; 0 + 2 = 2 missing
    expect(result.total).toBe(8);
    expect(result.filled).toBe(6);
    expect(result.percentage).toBe(75);
  });

  it("handles null schema gracefully", () => {
    const result = computeCompletion({}, undefined, []);
    expect(result).toEqual({ total: 0, filled: 0, percentage: 0 });
  });
});
