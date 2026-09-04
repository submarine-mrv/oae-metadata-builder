import { describe, expect, it } from "vitest";
import { rewriteEitherOrRules } from "../eitherOr.mjs";

const rule = (then) => ({ if: { properties: { mode: { const: "x" } } }, then });
const schemaWith = (then) => ({ $defs: { Thing: { allOf: [rule(then)] } } });
const anyOf = (a, b) => ({ anyOf: [a, b] });

describe("rewriteEitherOrRules", () => {
  it("rewrites a pure either/or into not-both-absent", () => {
    const schema = schemaWith(anyOf({ required: ["a"] }, { required: ["b"] }));
    expect(rewriteEitherOrRules(schema)).toBe(1);
    expect(schema.$defs.Thing.allOf[0].then).toEqual({
      not: { properties: { a: false, b: false } },
    });
  });

  it("treats LinkML's empty property stub as no constraint", () => {
    const schema = schemaWith(
      anyOf({ properties: { a: {} }, required: ["a"] }, { properties: { b: {} }, required: ["b"] }),
    );
    expect(rewriteEitherOrRules(schema)).toBe(1);
  });

  it("leaves a branch alone when its property schema is a boolean", () => {
    // `false` forbids the property; dropping it would loosen the rule.
    const then = anyOf({ properties: { a: false }, required: ["a"] }, { required: ["b"] });
    const schema = schemaWith(then);
    expect(rewriteEitherOrRules(schema)).toBe(0);
    expect(schema.$defs.Thing.allOf[0].then).toEqual(then);
  });

  it("leaves a branch alone when its property schema carries constraints", () => {
    const then = anyOf({ properties: { a: { minLength: 1 } }, required: ["a"] }, { required: ["b"] });
    expect(rewriteEitherOrRules(schemaWith(then))).toBe(0);
  });

  it("leaves three-way and multi-field anyOfs alone", () => {
    const three = { anyOf: [{ required: ["a"] }, { required: ["b"] }, { required: ["c"] }] };
    const multi = anyOf({ required: ["a", "b"] }, { required: ["c"] });
    expect(rewriteEitherOrRules(schemaWith(three))).toBe(0);
    expect(rewriteEitherOrRules(schemaWith(multi))).toBe(0);
  });

  it("also handles a bare root-level if/then", () => {
    const schema = { $defs: { Thing: rule(anyOf({ required: ["a"] }, { required: ["b"] })) } };
    expect(rewriteEitherOrRules(schema)).toBe(1);
    expect(schema.$defs.Thing.then.not).toBeDefined();
  });
});
