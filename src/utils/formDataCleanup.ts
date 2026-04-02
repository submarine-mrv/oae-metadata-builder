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
