/**
 * Remove empty arrays from form data.
 * RJSF leaves [] when the last array item is removed. Deleting the key
 * restores the field to "not present", which lets AJV's `required` check
 * work correctly and keeps the data clean (matching the initial blank state).
 */
export function stripEmptyArrays<T extends Record<string, unknown>>(data: T): T {
  const cleaned = { ...data };
  for (const key of Object.keys(cleaned)) {
    if (Array.isArray(cleaned[key]) && (cleaned[key] as unknown[]).length === 0) {
      delete cleaned[key];
    }
  }
  return cleaned;
}

/**
 * Returns true if the form data has no user-provided values.
 * Treats empty strings, null/undefined, empty arrays, and objects with only
 * empty values as "not filled" — so auto-propagated `project_id: ""` or
 * `experiment_id: ""` don't count as user input.
 */
export function isFormEmpty(
  data: Record<string, unknown> | undefined | null
): boolean {
  if (!data) return true;
  return !Object.values(data).some(isNonEmptyValue);
}

function isNonEmptyValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>).some(isNonEmptyValue);
  }
  return true;
}
