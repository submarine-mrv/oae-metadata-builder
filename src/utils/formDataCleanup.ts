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
 *
 * NOTE: does NOT strip empty strings (""). Some auto-propagated dataset fields
 * (e.g., project_id, experiment_id) are initialised as "" and must survive
 * until the real value is propagated. Use cleanVariableData for variable
 * objects where "" is never meaningful.
 */
export function cleanFormData<T extends Record<string, unknown>>(data: T): T {
  // The top-level form data object is always returned — even if empty —
  // so the caller always gets a usable object reference. Nested objects
  // that become empty after cleanup are dropped (return undefined) so
  // their parent key gets stripped entirely, matching the "not present"
  // semantics that AJV's `required` check relies on.
  return (cleanRecursive(data, false, /* isRoot */ true) ?? {}) as T;
}

/**
 * Like cleanFormData but also strips empty strings ("").
 *
 * Safe to use for variable objects (in the variable modal and dataset
 * validation path) where an empty string always means "not provided".
 * Do NOT use for top-level dataset or experiment form data — those have
 * auto-propagated string fields that legitimately start as "".
 */
export function cleanVariableData<T extends Record<string, unknown>>(data: T): T {
  return (cleanRecursive(data, true, /* isRoot */ true) ?? {}) as T;
}

function cleanRecursive(value: unknown, stripEmptyStrings: boolean, isRoot = false): unknown {
  if (value === null || value === undefined) return undefined;
  if (stripEmptyStrings && value === "") return undefined;

  if (Array.isArray(value)) {
    const cleanedItems = value
      .map((item) => cleanRecursive(item, stripEmptyStrings))
      .filter((item) => item !== undefined);
    return cleanedItems.length === 0 ? undefined : cleanedItems;
  }

  if (typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const cleanedValue = cleanRecursive(v, stripEmptyStrings);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    // Drop fully-cleared nested objects so their key is stripped from
    // the parent. Root-level form data is always kept, even if empty.
    if (!isRoot && Object.keys(cleaned).length === 0) {
      return undefined;
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
export function isFormEmpty(data: Record<string, unknown> | undefined | null): boolean {
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
