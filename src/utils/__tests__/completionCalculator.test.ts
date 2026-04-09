// completionCalculator.test.ts — filled-leaf + error dedupe approach.
// No schema access; tests pass raw error arrays shaped like RJSF errors.

import { describe, it, expect } from "vitest";
import { computeCompletion } from "../completionCalculator";
import type { RJSFValidationError } from "@rjsf/utils";

/** Build an RJSF-shaped error from a dotted/bracketed property path. */
function err(
  property: string,
  name: "required" | "format" | "type" = "required"
): RJSFValidationError {
  return {
    name,
    property,
    message: "x",
    params: {},
    stack: property,
    schemaPath: ""
  };
}

describe("computeCompletion", () => {
  it("returns 0% for an empty form with no errors", () => {
    expect(computeCompletion({}, [])).toEqual({
      total: 0,
      filled: 0,
      percentage: 0
    });
  });

  it("returns 100% for a fully filled form with no errors", () => {
    const data = { name: "Alice", email: "a@b.com", tags: ["x"] };
    expect(computeCompletion(data, [])).toEqual({
      total: 3,
      filled: 3,
      percentage: 100
    });
  });

  it("treats arrays of primitives as a single filled unit regardless of length", () => {
    const a = computeCompletion({ tags: ["x"] }, []);
    const b = computeCompletion({ tags: ["x", "y", "z"] }, []);
    expect(a.filled).toBe(1);
    expect(b.filled).toBe(1);
  });

  it("counts each non-empty primitive leaf", () => {
    const data = { name: "Alice", age: 30, active: true };
    const result = computeCompletion(data, []);
    expect(result.filled).toBe(3);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it("empty string and null/undefined are not filled", () => {
    const data = { name: "", email: null, phone: undefined, active: false };
    // `false` counts as filled (it's a user-provided boolean value)
    const result = computeCompletion(data, []);
    expect(result.filled).toBe(1);
  });

  it("errors subtract from filled: missing required field", () => {
    const data = { name: "Alice" };
    const errors = [err(".email")];
    const result = computeCompletion(data, errors);
    // 1 filled + 1 error = 2 total; 1 filled → 50%
    expect(result.total).toBe(2);
    expect(result.filled).toBe(1);
    expect(result.percentage).toBe(50);
  });

  it("a filled field with an error is NOT double-counted", () => {
    // Required email with invalid format. Field is present but errored.
    const data = { email: "not-an-email" };
    const errors = [err(".email", "format")];
    const result = computeCompletion(data, errors);
    // Filled \ errors = {} → 0 filled; errors = 1 → total 1 → 0%
    expect(result.total).toBe(1);
    expect(result.filled).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("dedupes multiple errors on the same field path", () => {
    const data = { email: "bad" };
    const errors = [
      err(".email", "format"),
      err(".email", "type"),
      err(".email") // required
    ];
    const result = computeCompletion(data, errors);
    // Still one unique error path
    expect(result.total).toBe(1);
    expect(result.filled).toBe(0);
  });

  it("flat object, 5 required of 10, monotonic transitions", () => {
    // Required: A,B,C,D,E. Optional: F,G,H,I,J.
    // State 1: nothing filled, all required missing
    let result = computeCompletion(
      {},
      ["A", "B", "C", "D", "E"].map((k) => err(`.${k}`))
    );
    expect(result.percentage).toBe(0);

    // State 2: A filled, B-E missing
    result = computeCompletion(
      { A: "x" },
      ["B", "C", "D", "E"].map((k) => err(`.${k}`))
    );
    expect(result.percentage).toBe(20);

    // State 3: A,B filled
    result = computeCompletion(
      { A: "x", B: "y" },
      ["C", "D", "E"].map((k) => err(`.${k}`))
    );
    expect(result.percentage).toBe(40);

    // State 4: all required filled, no optional → 100%
    result = computeCompletion(
      { A: "x", B: "y", C: "z", D: "w", E: "v" },
      []
    );
    expect(result.percentage).toBe(100);

    // State 5: +optional F valid → still 100%
    result = computeCompletion(
      { A: "x", B: "y", C: "z", D: "w", E: "v", F: "f" },
      []
    );
    expect(result.percentage).toBe(100);

    // State 6: +optional F has format error → drops
    result = computeCompletion(
      { A: "x", B: "y", C: "z", D: "w", E: "v", F: "bad" },
      [err(".F", "format")]
    );
    // filled = 5 (A-E), errors = 1 (F), total = 6 → 83%
    expect(result.filled).toBe(5);
    expect(result.total).toBe(6);
    expect(result.percentage).toBe(83);
  });

  it("erasing a valid required field drops percentage cleanly", () => {
    // All 5 required filled, then erase A
    const before = computeCompletion(
      { A: "x", B: "y", C: "z", D: "w", E: "v" },
      []
    );
    expect(before.percentage).toBe(100);

    const after = computeCompletion(
      { B: "y", C: "z", D: "w", E: "v" },
      [err(".A")]
    );
    // 4 filled + 1 error = 5 → 80%
    expect(after.percentage).toBe(80);
  });

  it("nested objects: credit for partially-filled children", () => {
    const data = {
      name: "Root",
      contact: { name: "Alice" } // contact.email missing
    };
    const errors = [err(".contact.email")];
    const result = computeCompletion(data, errors);
    // Filled: .name, .contact.name = 2; errors: .contact.email = 1
    expect(result.filled).toBe(2);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(67);
  });

  it("array of objects with partially-filled items gets credit per item", () => {
    const data = {
      leads: [
        { name: "Alice", email: "a@b.com" },
        { name: "Bob" } // missing email
      ]
    };
    const errors = [err(".leads[1].email")];
    const result = computeCompletion(data, errors);
    // Filled: leads[0].name, leads[0].email, leads[1].name = 3
    // Errors: leads[1].email = 1
    // Total = 4; % = 75
    expect(result.filled).toBe(3);
    expect(result.total).toBe(4);
    expect(result.percentage).toBe(75);
  });

  it("array of shells contributes 0 filled + N errors", () => {
    const data = { leads: [{}, {}] };
    const errors = [
      err(".leads[0].name"),
      err(".leads[0].email"),
      err(".leads[1].name"),
      err(".leads[1].email")
    ];
    const result = computeCompletion(data, errors);
    expect(result.filled).toBe(0);
    expect(result.total).toBe(4);
    expect(result.percentage).toBe(0);
  });

  it("primitive array with an invalid item loses its filled credit", () => {
    // tags is stored as a single filled path /tags, but AJV reports the
    // error on /tags/0. The ancestor walk must strip /tags from filled
    // so the invalid item doesn't keep its credit.
    const data = { tags: ["bad"] };
    const result = computeCompletion(data, [err(".tags[0]", "format")]);
    expect(result.filled).toBe(0);
    expect(result.total).toBe(1);
    expect(result.percentage).toBe(0);
  });

  it("nested object error does not strip sibling filled leaves", () => {
    // Error at .data_submitter.email must not remove .data_submitter.name
    // from filled via the ancestor walk.
    const data = { data_submitter: { name: "X", email: "bad" } };
    const result = computeCompletion(data, [
      err(".data_submitter.email", "format")
    ]);
    // filled: /data_submitter/name. errors: /data_submitter/email.
    expect(result.filled).toBe(1);
    expect(result.total).toBe(2);
    expect(result.percentage).toBe(50);
  });

  it("empty array of primitives + required error → 0%", () => {
    const result = computeCompletion({ tags: [] }, [err(".tags")]);
    expect(result.filled).toBe(0);
    expect(result.total).toBe(1);
    expect(result.percentage).toBe(0);
  });

  it("handles undefined data", () => {
    expect(computeCompletion(undefined, [])).toEqual({
      total: 0,
      filled: 0,
      percentage: 0
    });
  });
});
