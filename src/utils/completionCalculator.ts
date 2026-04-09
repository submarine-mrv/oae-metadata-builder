// completionCalculator.ts - Lightweight completion percentage from form data + AJV errors
//
// ============================================================================
// DESIGN INTENT — READ THIS BEFORE FILING A REVIEW FINDING
// ============================================================================
//
// The % on the overview cards is a *progress hint*, not an audit figure. Its
// only jobs are:
//
//   (1) to nudge toward 100% as the user fills required fields
//   (2) to stay under 100% while the validator still reports problems
//   (3) to drop cleanly when the user clears something they had filled
//
// It is explicitly NOT trying to be "% of required fields filled per the
// schema", and does not need to be. Precision isn't the product — the
// validation button + error list is the authoritative signal for
// correctness. The % just wants to feel responsive and directionally right.
//
// Formula:
//
//   filled = set of paths with a non-empty primitive leaf value in the data
//            (arrays of primitives count as ONE path for the whole array;
//             object/array-item structure is recursed into)
//   errors = set of unique error paths from the validator
//            (required + format + pattern + cross-field, deduped)
//   filled := filled \ errors   // disjoint: a filled leaf with an error at
//                               // the same path counts as an error, not filled
//   total  := |filled| + |errors|
//   percent = round(filled / total * 100)   (0% when total = 0)
//
// ----------------------------------------------------------------------------
// Why schema-free? (Deliberate, after two iterations of the walker approach)
// ----------------------------------------------------------------------------
//
// Earlier versions walked the JSON Schema's `required` arrays to produce a
// "missing / total" count. That design had persistent problems:
//
//   - It drifted from the schema (hardcoded field lists) — FIXED by walking,
//     which then broke on...
//   - Conditional requireds: `if/then`, `allOf`, `oneOf`, discriminator-based
//     `required` arrays were not evaluated, so completion was inflated for
//     forms with conditional requirements.
//   - $ref resolution, nested required objects, and array-item recursion all
//     had to be re-implemented by hand, with edge cases for shells, absent
//     vs. present required objects, and polymorphic dataset variables.
//   - Double-counting of variable errors when datasets passed both an `extra`
//     count and a full error list to the old computeCompletion.
//
// AJV already handles ALL of the above correctly against real form data:
// conditional requireds, $ref, polymorphism, cross-field custom validators.
// Instead of reproducing that logic, this module:
//
//   - Trusts AJV for "what's wrong with the form right now" (the numerator
//     problem), and
//   - Walks only the raw data for "what has the user actually touched"
//     (no schema needed — structure is self-evident from the data).
//
// The union of those two sets is the denominator. Disjointing them prevents
// a touched-but-invalid field from being counted twice.
//
// ----------------------------------------------------------------------------
// Known quirk: optional-field touches nudge the percentage
// ----------------------------------------------------------------------------
//
// Because the denominator is "things touched + things wrong", filling or
// clearing an *optional* valid field shifts the % slightly (smaller than a
// required change, same direction). Example with 3/10 required and 2
// optional filled: clearing an optional moves ~−6%, clearing a required
// moves ~−9%. This is intentional and acceptable:
//
//   - The direction is always correct (filling helps, clearing hurts).
//   - Requireds move the bar ~2× as much as optionals (because clearing a
//     required also adds a validator error, double-hitting the ratio).
//   - Transitions are reversible: fill → clear → fill returns to the same %.
//   - The alternative — making optional touches zero-delta — requires the
//     walker to classify each field as required-vs-optional against
//     conditional schemas, which is the complexity we just removed.
//
// ----------------------------------------------------------------------------
// Known quirk: 0/0 returns 0%, not 100%
// ----------------------------------------------------------------------------
//
// An untouched form with no validator errors is reported as 0%. This is
// *intentional* for the overview UX: an unstarted entity should not appear
// complete. Entities with genuinely no required fields are rare in this
// schema, and if they exist the user expectation is still "I haven't
// started this", not "this is done".
//
// ----------------------------------------------------------------------------
// Why not double-count required errors (severity: None, addressed)
// ----------------------------------------------------------------------------
//
// All errors (required + format + cross-field) dedupe into a single set
// keyed by normalized instancePath. A field reported by AJV as both
// "required" and "format" appears once. A variable with errors surfaced by
// both the dataset validator and a per-variable custom validator appears
// once. This is the deduping layer that solves the earlier dataset
// double-penalty bug.

import type { FormDataRecord } from "@/types/forms";
import type { RJSFValidationError } from "@rjsf/utils";

// =============================================================================
// Filled-leaf collection
// =============================================================================

/** True if a primitive value counts as "filled" for completion purposes. */
function isPrimitiveFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  return false;
}

/**
 * Walk form data and collect the set of paths (in AJV instancePath form)
 * that have a non-empty primitive leaf value.
 *
 *   - Primitive leaf → path added if `isPrimitiveFilled`.
 *   - Array of primitives → the array's own path added once if non-empty
 *     (users aren't rewarded for length; having at least one entry satisfies
 *     the structural "atleast one" meaning of a required array).
 *   - Array of objects → recurse into each item with `[i]` path segment.
 *   - Object → recurse into each property with `.key` path segment.
 */
function collectFilledLeafPaths(
  data: unknown,
  path: string,
  out: Set<string>
): void {
  if (data === undefined || data === null) return;

  if (Array.isArray(data)) {
    if (data.length === 0) return;
    // Decide "array of primitives" by the first non-null item. Mixed arrays
    // are rare in these schemas; the first item is a good proxy.
    const firstObjectIdx = data.findIndex(
      (item) => item !== null && typeof item === "object"
    );
    if (firstObjectIdx === -1) {
      // All primitives — count the whole array as one filled path if any
      // individual entry is primitive-filled.
      if (data.some((item) => isPrimitiveFilled(item))) {
        out.add(path);
      }
      return;
    }
    // Has at least one object item → recurse into each item.
    data.forEach((item, i) => {
      collectFilledLeafPaths(item, `${path}/${i}`, out);
    });
    return;
  }

  if (typeof data === "object") {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      collectFilledLeafPaths(value, `${path}/${key}`, out);
    }
    return;
  }

  if (isPrimitiveFilled(data)) out.add(path);
}

// =============================================================================
// Error path normalization
// =============================================================================

/**
 * Normalize an RJSF/AJV error into a single instancePath-shaped string so
 * we can dedupe with the filled-leaf paths. RJSF errors expose the path as
 * `.foo.bar[0].baz` in the `property` field; we convert that into AJV's
 * `/foo/bar/0/baz` form.
 */
function errorPath(err: RJSFValidationError): string {
  const prop = err.property ?? "";
  // Strip leading dot, convert [n] → /n, convert . → /
  return prop
    .replace(/^\./, "")
    .replace(/\[(\d+)\]/g, "/$1")
    .split(".")
    .join("/")
    .replace(/^/, "/");
}

// =============================================================================
// Public API
// =============================================================================

export interface CompletionResult {
  total: number;
  filled: number;
  percentage: number;
}

/**
 * Compute completion % from form data + validation errors alone.
 *
 * No schema access: the denominator is derived from "how many things has
 * the user actually touched" + "how many problems does the validator see",
 * with dedupe so a touched-but-invalid field only counts once.
 */
export function computeCompletion(
  data: FormDataRecord | null | undefined,
  validationErrors: RJSFValidationError[]
): CompletionResult {
  const filled = new Set<string>();
  if (data) collectFilledLeafPaths(data, "", filled);

  const errors = new Set<string>();
  for (const err of validationErrors) {
    errors.add(errorPath(err));
  }

  // Disjoint: a filled leaf that also has an error belongs to `errors`, not
  // `filled` (no partial credit for invalid values).
  for (const path of errors) filled.delete(path);

  const filledCount = filled.size;
  const errorCount = errors.size;
  const total = filledCount + errorCount;

  if (total === 0) return { total: 0, filled: 0, percentage: 0 };

  const percentage = Math.round((filledCount / total) * 100);
  return { total, filled: filledCount, percentage };
}

