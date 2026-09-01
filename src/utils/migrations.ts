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
 * Protocol 0.4.0 turned `public_comments` from one comma-separated string into a
 * list of `{ filename, comment_type }`. The old field told users to separate
 * filenames with commas, so split on that and leave the type for them to pick.
 */
export function migratePublicComments(data: Record<string, any>): Record<string, any> {
  const value = data?.public_comments;
  if (typeof value !== "string") return data;

  const comments = value
    .split(",")
    .map((filename) => filename.trim())
    .filter(Boolean)
    .map((filename) => ({ filename, comment_type: "other" }));

  // An empty or whitespace-only string carried no filenames worth keeping.
  if (comments.length === 0) {
    const { public_comments: _dropped, ...rest } = data;
    return rest;
  }
  return { ...data, public_comments: comments };
}

// Ordered list of migrations to apply. Each takes a form data object and
// returns the (possibly updated) object. Return the same reference if no
// changes are needed to avoid unnecessary re-renders.
const MIGRATIONS: Array<(data: Record<string, any>) => Record<string, any>> = [
  migrateFormDataBoxStrings, // v0: W S E N → S W N E (SOSO format)
  migratePublicComments, // 0.4.0: "a.pdf, b.pdf" → [{ filename, comment_type }]
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
