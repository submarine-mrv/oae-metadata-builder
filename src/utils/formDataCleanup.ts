/**
 * Recursively clean form data:
 *   - Remove empty arrays (RJSF leaves `[]` when the last item is removed)
 *   - Remove `null` values (Mantine widgets pass `null` when a field is
 *     cleared, which makes AJV report "must be string" for type:string fields)
 *   - Recurse into objects and array items so nested fields are cleaned too
 *
 * Deleting the key restores the field to "not present", which lets AJV's
 * `required` check work correctly and keeps the data clean (matching the
 * initial blank state).
 */
export function cleanFormData<T extends Record<string, unknown>>(data: T): T {
  return (cleanRecursive(data) ?? {}) as T;
}

function cleanRecursive(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    const cleanedItems = value
      .map(cleanRecursive)
      .filter((item) => item !== undefined);
    return cleanedItems.length === 0 ? undefined : cleanedItems;
  }

  if (typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const cleanedValue = cleanRecursive(v);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }

  return value;
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
