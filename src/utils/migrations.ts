/**
 * Form data migrations — normalize data from older app versions on load.
 *
 * Each migration function handles one specific format change. They are run
 * in order by `migrateFormData`, which is called at load boundaries (session
 * restore and file import) — NOT on every form change.
 *
 * When adding a new migration:
 *   1. Write a pure function: (data) => data (return same ref if no change)
 *   2. Add it to the MIGRATIONS array below
 *   3. Add tests in __tests__/migrations.test.ts
 */

import { migrateFormDataBoxStrings } from "./spatialUtils";

/**
 * Protocol 0.4.0 turned `public_comments` from one free-text string into a list
 * of `{ url, comment_type, description }`. The old text was filenames, not
 * links, so it is kept whole as the description of a single entry rather than
 * guessed into URLs. `url` is left empty and required, which flags the entry
 * for the user to complete.
 */
export function migratePublicComments(data: Record<string, any>): Record<string, any> {
  const value = data?.public_comments;

  // An interim shape from the same release cycle used `filename` where the
  // schema now has `url`. The filename was never a link, so it becomes the
  // description and the entry is left for the user to complete.
  if (Array.isArray(value)) {
    let changed = false;
    const entries = value.map((entry) => {
      if (!entry || typeof entry !== "object" || !("filename" in entry)) return entry;
      changed = true;
      const { filename, ...rest } = entry as Record<string, unknown>;
      return { ...rest, description: rest.description ?? filename };
    });
    return changed ? { ...data, public_comments: entries } : data;
  }

  if (typeof value !== "string") return data;

  const text = value.trim();
  if (!text) {
    const { public_comments: _dropped, ...rest } = data;
    return rest;
  }
  return { ...data, public_comments: [{ description: text, comment_type: "other" }] };
}

// Ordered list of migrations to apply. Each takes a form data object and
// returns the (possibly updated) object. Return the same reference if no
// changes are needed to avoid unnecessary re-renders.
const MIGRATIONS: Array<(data: Record<string, any>) => Record<string, any>> = [
  migrateFormDataBoxStrings, // v0: W S E N → S W N E (SOSO format)
  migratePublicComments, // 0.4.0: old text → one [{ description, comment_type }]
];

/**
 * Run all registered migrations on a form data object.
 * Called at load boundaries: session restore and JSON file import.
 */
export function migrateFormData<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== "object") return data;
  let result: Record<string, any> = data;
  for (const migrate of MIGRATIONS) {
    result = migrate(result);
  }
  return result as T;
}
