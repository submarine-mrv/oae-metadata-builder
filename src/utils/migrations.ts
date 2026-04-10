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

// Ordered list of migrations to apply. Each takes a form data object and
// returns the (possibly updated) object. Return the same reference if no
// changes are needed to avoid unnecessary re-renders.
const MIGRATIONS: Array<(data: Record<string, any>) => Record<string, any>> = [
  migrateFormDataBoxStrings, // v0: W S E N → S W N E (SOSO format)
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
