import { describe, expect, it } from "vitest";
import { jsonDiff } from "../jsonDiff";

const value = (v: unknown) => ({ present: true as const, value: v });
const missing = { present: false as const };
const paths = (a: unknown, b: unknown) =>
  jsonDiff(value(a), value(b)).map(({ path, change, to }) =>
    [change, path, to].filter(Boolean).join(" "),
  );

describe("jsonDiff", () => {
  it("shows only changed nested paths and ignores key order", () => {
    expect(
      jsonDiff(
        value({ a: 1, nested: { same: true, units: "mol/kg" } }),
        value({ nested: { units: "mmol/kg", same: true }, a: 1 }),
      ),
    ).toEqual([
      { path: "/nested/units", change: "changed", left: value("mol/kg"), right: value("mmol/kg") },
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

  it("matches array items by content, not position", () => {
    const jeanine = { name: "Jeanine Ash", email: "j@example.com" };
    const sample = { name: "Sample Name", email: "sample@example.com" };
    const newPerson = { name: "New Person", email: "new@example.com" };
    const edited = { ...jeanine, name: "Jeanine 2" };
    expect(paths([jeanine, sample], [jeanine, newPerson, sample])).toEqual(["added /1"]);
    expect(paths([jeanine, sample], [edited, newPerson, sample])).toEqual([
      "changed /0/name",
      "added /1",
    ]);
    expect(paths([jeanine, sample], [sample])).toEqual(["removed /0"]);
    expect(paths(["x", "y", "z"], ["w", "x", "y", "z"])).toEqual(["added /0"]);
    expect(paths(["x", "y"], ["y", "x"])).toEqual(["moved /1 /0"]);
    expect(paths([{ a: 1, b: 2 }, { c: 3 }], [{ c: 3 }, { b: 2, a: 1 }])).toEqual(["moved /1 /0"]);
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
