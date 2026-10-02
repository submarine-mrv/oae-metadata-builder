import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../relativeTime";

const NOW = Date.parse("2026-09-15T12:00:00Z");

describe("formatRelativeTime", () => {
  it.each([
    [NOW - 20_000, "just now"],
    [NOW - 5 * 60_000, "5 minutes ago"],
    [NOW - 60 * 60_000, "1 hour ago"],
    [NOW - 3 * 24 * 60 * 60_000, "3 days ago"],
    [NOW - 40 * 24 * 60 * 60_000, "1 month ago"],
  ])("formats %d as %s", (then, expected) => {
    expect(formatRelativeTime(then, NOW)).toBe(expected);
  });
});
