/**
 * Form data migrations — normalize data from older app versions on load.
 *
 * Each migration function handles one specific format change. They are run
 * in order by `migrateFormData`, which is called at load boundaries (project
 * load and file import) — NOT on every form change.
 *
 * Migrations detect the old shape instead of checking a version: stored
 * projects carry no protocol version, and a file's `version` can be wrong.
 * Gate a migration on version only if its old shape is also valid today.
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

/**
 * Protocol 0.6.0 renamed the project's `research_project` to `name`. An existing
 * non-empty `name` wins.
 */
export function migrateResearchProject(data: Record<string, any>): Record<string, any> {
  if (!data || !("research_project" in data)) return data;
  const { research_project, ...rest } = data;
  const hasName = typeof rest.name === "string" && rest.name.trim() !== "";
  return hasName ? rest : { ...rest, name: research_project };
}

const DYE_FIELDS = ["dye_purified", "correction_for_unpurified_dye", "dye_correction_method"];

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function migratePHCalibration(cal: Record<string, any>): Record<string, any> {
  let result = cal;
  if ("dye_type_and_manufacturer" in cal) {
    const { dye_type_and_manufacturer, ...rest } = cal;
    result = hasValue(rest.standard_type_and_production)
      ? rest
      : { ...rest, standard_type_and_production: dye_type_and_manufacturer };
  }
  const usedDye =
    hasValue(cal.dye_type_and_manufacturer) || DYE_FIELDS.some((key) => hasValue(cal[key]));
  if (usedDye && !hasValue(result.standard_used)) {
    result = { ...result, standard_used: "dye" };
  }
  return result;
}

/**
 * Protocol 0.6.0 added `standard_used` to pH calibration and renamed
 * `dye_type_and_manufacturer` to `standard_type_and_production`. A calibration
 * with any dye field filled in gets `standard_used: "dye"`, since the dye
 * fields are hidden until that standard is picked.
 */
export function migratePHCalibrationStandard(data: Record<string, any>): Record<string, any> {
  const variables = data?.variables;
  if (!Array.isArray(variables)) return data;
  let changed = false;
  const next = variables.map((variable) => {
    const cal = variable?.analyzing_instrument?.calibration;
    if (!cal || typeof cal !== "object") return variable;
    const migrated = migratePHCalibration(cal);
    if (migrated === cal) return variable;
    changed = true;
    return {
      ...variable,
      analyzing_instrument: { ...variable.analyzing_instrument, calibration: migrated },
    };
  });
  return changed ? { ...data, variables: next } : data;
}

// Ordered list of migrations to apply. Each takes a form data object and
// returns the (possibly updated) object. Return the same reference if no
// changes are needed to avoid unnecessary re-renders.
const MIGRATIONS: Array<(data: Record<string, any>) => Record<string, any>> = [
  migrateFormDataBoxStrings, // v0: W S E N → S W N E (SOSO format)
  migratePublicComments, // 0.4.0: old text → one [{ description, comment_type }]
  migrateResearchProject, // 0.6.0: project research_project → name
  migratePHCalibrationStandard, // 0.6.0: pH calibration standard_used, dye type rename
];

/**
 * Run all registered migrations on a form data object.
 * Called at load boundaries: project load and JSON file import.
 */
export function migrateFormData<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== "object") return data;
  let result: Record<string, any> = data;
  for (const migrate of MIGRATIONS) {
    result = migrate(result);
  }
  return result as T;
}
