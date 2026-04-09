// completionCalculator.ts - Lightweight completion percentage from form data + AJV errors
//
// The % on the overview cards is "kind of right" by design, not an audit
// figure. We compute it without walking the JSON Schema at all:
//
//   filled = set of paths with a non-empty primitive leaf value in the data
//            (arrays of primitives count as ONE path for the whole array)
//   errors = set of unique error paths from the validator
//   filled := filled \ errors   // disjoint: a field with an error is not "filled"
//   total  := |filled| + |errors|
//   percent = round(filled / total * 100)
//
// Properties:
//   - Schema-free: no walking `required` arrays, no conditional handling —
//     AJV already evaluates if/then/allOf/oneOf against real data and
//     surfaces missing/invalid fields as errors.
//   - No double counting: each path contributes at most 1 to the denominator,
//     either as a "filled" leaf or as an "error", never both.
//   - Array shells work: `[{},{}]` has 0 filled leaves and AJV reports
//     required errors for each missing inner field → denominator grows,
//     filled stays at 0, % drops, as desired.
//   - Partially-filled objects/items get credit for their filled leaves.
//   - Adding or removing optional fields that are valid is a no-op at 100%.
//
// 0/0 case returns 0% (an untouched empty-schema form should not read 100%).

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

