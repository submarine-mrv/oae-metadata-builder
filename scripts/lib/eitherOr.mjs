// Rewrite "at least one of A, B" rules for RJSF.
//
// LinkML emits `postconditions: any_of` as `then: { anyOf: [{required: [A]},
// {required: [B]}] }`. AJV validates that fine, but RJSF renders a merged
// `anyOf` as an "Option 1 / Option 2" selector, and a nested if/then form
// resolves into `required` and draws an asterisk on whichever field the data
// happens to leave empty. Neither field is required on its own.
//
// `then: { not: { properties: { A: false, B: false } } }` says "not both
// absent": AJV rejects the object only when neither key is present, and RJSF
// ignores `not` for rendering, so no selector and no asterisk. Only two-branch,
// required-only anyOfs are rewritten; anything else is left alone so a
// genuinely different shape fails loudly in review.
export function rewriteEitherOrRules(schema) {
  let rewritten = 0;
  // A branch qualifies only if it is purely "this one field is required":
  // LinkML emits `properties: { field: {} }` alongside `required`, and an
  // empty schema there adds no constraint. Anything else is left as is, so a
  // rule that actually constrains the field is never silently loosened.
  const requiredOf = (branch) => {
    if (!branch || !Array.isArray(branch.required) || branch.required.length !== 1) return null;
    const field = branch.required[0];
    for (const [key, value] of Object.entries(branch)) {
      if (key === "required") continue;
      if (key !== "properties") return null;
      const propKeys = Object.keys(value ?? {});
      if (propKeys.length > 1 || (propKeys.length === 1 && propKeys[0] !== field)) return null;
      if (propKeys.length === 1) {
        // Only an empty object schema adds no constraint. A boolean schema
        // (`false` forbids the property) or anything with keys must survive.
        const fieldSchema = value[field];
        const isEmptyObject =
          fieldSchema !== null &&
          typeof fieldSchema === "object" &&
          !Array.isArray(fieldSchema) &&
          Object.keys(fieldSchema).length === 0;
        if (!isEmptyObject) return null;
      }
    }
    return field;
  };

  const rewrite = (rule) => {
    const anyOf = rule?.then?.anyOf;
    if (!Array.isArray(anyOf) || anyOf.length !== 2) return;
    const [a, b] = anyOf.map(requiredOf);
    if (!a || !b) return;
    // A `then` that already carries a `not` would lose it to the rewrite.
    // Leave such a rule alone; it fails loudly in review rather than silently.
    if ("not" in rule.then) return;
    // Only the anyOf is replaced; anything else in the `then` still applies.
    const { anyOf: _replaced, ...rest } = rule.then;
    rule.then = { ...rest, not: { properties: { [a]: false, [b]: false } } };
    rewritten += 1;
  };

  for (const def of Object.values(schema.$defs ?? {})) {
    if (def.if && def.then) rewrite(def);
    for (const rule of def.allOf ?? []) rewrite(rule);
  }
  return rewritten;
}

