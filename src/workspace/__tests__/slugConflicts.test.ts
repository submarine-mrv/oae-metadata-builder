import { describe, expect, it } from "vitest";
import { normalizeHumanId } from "../slugConflicts";

describe("normalizeHumanId", () => {
  it("replaces whitespace runs with hyphens and trims surrounding whitespace", () => {
    expect(normalizeHumanId("  Sample \t id  ")).toBe("Sample-id");
  });

  it("preserves case and existing allowed separators", () => {
    expect(normalizeHumanId("Mixed_Case-1")).toBe("Mixed_Case-1");
  });
});
