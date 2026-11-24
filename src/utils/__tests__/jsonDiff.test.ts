import { describe, expect, it } from "vitest";
import { jsonDiff } from "../jsonDiff";

const value = (v: unknown) => ({ present: true as const, value: v });
const missing = { present: false as const };
const paths = (a: unknown, b: unknown) =>
  jsonDiff(value(a), value(b)).map(({ path, change }) => `${change} ${path}`);

describe("jsonDiff", () => {
  it("shows only changed nested paths and ignores key order", () => {
    expect(
      jsonDiff(
        value({ a: 1, nested: { same: true, units: "mol/kg" } }),
        value({ nested: { units: "mmol/kg", same: true }, a: 1 }),
      ),
    ).toEqual([
      {
        path: "/nested/units",
        change: "changed",
        left: value("mol/kg"),
        right: value("mmol/kg"),
      },
    ]);
  });

  it("keeps missing, null and differently typed values distinct", () => {
    expect(paths({ a: null, b: 1, c: false }, { b: "1", c: false, d: null })).toEqual([
      "removed /a",
      "changed /b",
      "added /d",
    ]);
    expect(paths({ a: undefined }, {})).toEqual([]);
  });

  it("compares arrays by position, including duplicates and reorders", () => {
    expect(paths(["x", "y"], ["y", "x"])).toEqual(["changed /0", "changed /1"]);
    expect(paths(["x"], ["x", "x"])).toEqual(["added /1"]);
    expect(paths([1, 2, 3], [1, 2])).toEqual(["removed /2"]);
  });

  it("reports a container or type replacement as one row", () => {
    expect(paths({ a: { b: 1 } }, { a: [1] })).toEqual(["changed /a"]);
    expect(jsonDiff(missing, value({ a: 1 }))).toEqual([
      { path: "", change: "added", left: missing, right: value({ a: 1 }) },
    ]);
  });

  it("escapes keys as JSON Pointer segments", () => {
    expect(paths({ "a/b": 1, "c~d": 1 }, { "a/b": 2, "c~d": 2 })).toEqual([
      "changed /a~1b",
      "changed /c~0d",
    ]);
  });
});
