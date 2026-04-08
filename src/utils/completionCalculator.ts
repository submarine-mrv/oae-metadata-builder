// completionCalculator.ts - Calculate form completion percentages and missing field counts

import type {
  FormDataRecord,
  ProjectFormData,
  ExperimentFormData,
  DatasetFormData,
  VariableFormData
} from "@/types/forms";
import type { RJSFSchema, RJSFValidationError } from "@rjsf/utils";
import {
  getAccordionConfig,
  normalizeFieldConfig
} from "@/components/VariableModal/variableModalConfig";
import {
  resolveRef,
  fieldExistsInSchema,
  isFieldRequired,
  getNestedValue,
  type JSONSchema
} from "@/components/schemaUtils";

// =============================================================================
// Schema-Driven Required Field Counting
// =============================================================================
//
// Everything here walks the JSON Schema's `required` arrays recursively to
// count required fields. Previously we maintained a hardcoded list of
// required fields per form type; that drifted out of sync with the schema.
// The schema is now the single source of truth.
//
// Semantics (matching AJV and the existing form validation):
//   - Missing required primitive                        → 1 missing
//   - Missing required array (empty or absent)          → 1 missing
//   - Missing required object (absent)                  → 1 missing
//   - Present required object with missing inner fields → recurse; counts
//                                                         the inner missing
//                                                         (NOT the parent)
//   - Array items are NOT recursed (datasets handle
//     variables separately via countIncompleteVariables)
// =============================================================================

/** Check if a primitive value is considered "filled". */
function isPrimitiveFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  return false;
}

/** Check if an array field is considered "filled" (non-empty). */
function isArrayFilled(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.length > 0;
}

/** Resolve a property schema, handling $ref. */
function resolvePropertySchema(
  propSchema: JSONSchema | undefined,
  rootSchema: JSONSchema
): JSONSchema | undefined {
  if (!propSchema) return undefined;
  if (propSchema.$ref) {
    const resolved = resolveRef(propSchema, rootSchema);
    return resolved || undefined;
  }
  return propSchema;
}

/** Get the effective type, unwrapping `["string", "null"]`-style arrays. */
function getSchemaType(schema: JSONSchema): string | undefined {
  if (!schema.type) return undefined;
  if (Array.isArray(schema.type)) {
    return schema.type.find((t) => t !== "null");
  }
  return schema.type as string;
}

/**
 * Recursively walk the schema and count required fields, tracking both
 * the total number of required fields and how many are missing.
 *
 * Returns { total, missing } so callers can derive a completion
 * percentage without walking twice.
 */
function walkRequiredFields(
  data: FormDataRecord | null | undefined,
  schema: JSONSchema,
  rootSchema: JSONSchema,
  skipFields: Set<string> | undefined
): { total: number; missing: number } {
  let total = 0;
  let missing = 0;

  const requiredFields = schema.required || [];
  const properties = schema.properties || {};

  for (const fieldName of requiredFields) {
    if (skipFields?.has(fieldName)) continue;

    const propSchema = resolvePropertySchema(
      properties[fieldName] as JSONSchema | undefined,
      rootSchema
    );
    const value = data?.[fieldName];

    if (!propSchema) {
      // No schema for this field — treat as a primitive.
      total += 1;
      if (!isPrimitiveFilled(value)) missing += 1;
      continue;
    }

    const schemaType = getSchemaType(propSchema);

    if (schemaType === "array") {
      // Arrays: empty/absent = 1 total, 1 missing.
      // Non-empty primitive arrays = 1 total, 0 missing (atleast-one rule —
      // the schema just requires "some" value, not a per-item count).
      // Non-empty object arrays = recurse into each item and sum inner
      // totals/missings, so shells (`[{}]`) correctly contribute their
      // inner required fields to both numerator and denominator.
      if (!isArrayFilled(value)) {
        total += 1;
        missing += 1;
      } else {
        const itemSchema = resolvePropertySchema(
          propSchema.items as JSONSchema | undefined,
          rootSchema
        );
        const itemIsObject =
          itemSchema &&
          (getSchemaType(itemSchema) === "object" || !!itemSchema.properties);
        if (itemSchema && itemIsObject) {
          for (const item of value as unknown[]) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              const inner = walkRequiredFields(
                item as FormDataRecord,
                itemSchema,
                rootSchema,
                undefined
              );
              total += inner.total;
              missing += inner.missing;
            }
          }
        } else {
          // Primitive array satisfied by having at least one item.
          total += 1;
        }
      }
    } else if (schemaType === "object" || propSchema.properties) {
      if (value === undefined || value === null) {
        // Absent object is one missing required field.
        total += 1;
        missing += 1;
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Present object — recurse into its own required fields. The
        // parent field itself is NOT counted separately; the inner
        // required fields represent the completion work.
        const inner = walkRequiredFields(
          value as FormDataRecord,
          propSchema,
          rootSchema,
          undefined
        );
        total += inner.total;
        missing += inner.missing;
      } else {
        // Unexpected shape (e.g., string where object expected) — count
        // as 1 missing.
        total += 1;
        missing += 1;
      }
    } else {
      // Primitive
      total += 1;
      if (!isPrimitiveFilled(value)) missing += 1;
    }
  }

  return { total, missing };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Count missing required fields for any form data using its schema.
 * Recursively checks nested objects.
 */
export function countMissingRequiredFields(
  data: FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema,
  skipFields?: string[]
): number {
  if (!schema) return 0;
  const skipSet = skipFields ? new Set(skipFields) : undefined;
  return walkRequiredFields(
    data,
    schema as JSONSchema,
    schema as JSONSchema,
    skipSet
  ).missing;
}

/**
 * Count total required fields for any form data using its schema.
 * Recursively checks nested objects (same traversal as
 * countMissingRequiredFields).
 */
export function countTotalRequiredFields(
  data: FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema,
  skipFields?: string[]
): number {
  if (!schema) return 0;
  const skipSet = skipFields ? new Set(skipFields) : undefined;
  return walkRequiredFields(
    data,
    schema as JSONSchema,
    schema as JSONSchema,
    skipSet
  ).total;
}

/**
 * Count missing required fields for dataset data (excluding variables).
 * Variables are counted separately via countIncompleteVariables.
 * Also excludes project_id and experiment_id which are auto-managed.
 */
export function countMissingDatasetFields(
  datasetData: DatasetFormData | FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema
): number {
  return countMissingRequiredFields(datasetData, schema, [
    "variables",
    "project_id",
    "experiment_id"
  ]);
}

/**
 * Count missing required fields for project data.
 */
export function countMissingProjectFields(
  projectData: ProjectFormData | FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema
): number {
  return countMissingRequiredFields(projectData, schema);
}

/**
 * Count missing required fields for experiment data.
 * Excludes project_id which is auto-managed.
 */
export function countMissingExperimentFields(
  experimentData: ExperimentFormData | FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema
): number {
  return countMissingRequiredFields(experimentData, schema, ["project_id"]);
}

// =============================================================================
// Completion Percentage
// =============================================================================

export interface CompletionResult {
  /** Total number of required items (schema-driven + any extras added by caller). */
  total: number;
  /** Items that are present and have no outstanding validation errors. */
  filled: number;
  /** Rounded percentage 0-100. */
  percentage: number;
}

/**
 * Compute completion percentage for a form against its schema.
 *
 * Formula:
 *   total  = required fields in schema (recursive)
 *   missing = required fields that are empty/absent (recursive)
 *   errors = non-required validation errors (format, pattern, cross-field, etc.)
 *   filled = max(0, total - missing - errors)
 *   percentage = round(filled / total * 100)
 *
 * Non-required errors subtract from "filled" because a field that has a
 * value but fails validation isn't really done. This is the same logic
 * the validation badge uses to decide green-vs-other.
 *
 * When the form has no required fields, returns 100% (trivially complete).
 *
 * @param data             Form data to score.
 * @param schema           The JSON Schema to walk for required fields.
 * @param validationErrors The validation errors for this data — typically
 *                         from `validate*()` in utils/validation. Required
 *                         errors are ignored (they're already counted by
 *                         the schema walk); all others subtract from filled.
 * @param skipFields       Top-level required fields to ignore in the count
 *                         (e.g. `variables` on datasets, since they're
 *                         counted separately).
 * @param extra            Optional extra totals to add (used by datasets
 *                         to include per-variable completion).
 */
export function computeCompletion(
  data: FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema | undefined,
  validationErrors: RJSFValidationError[],
  skipFields?: string[],
  extra: { total?: number; missing?: number } = {}
): CompletionResult {
  if (!schema) return { total: 0, filled: 0, percentage: 0 };

  const walk = walkRequiredFields(
    data,
    schema as JSONSchema,
    schema as JSONSchema,
    skipFields ? new Set(skipFields) : undefined
  );

  const total = walk.total + (extra.total ?? 0);
  const missing = walk.missing + (extra.missing ?? 0);

  if (total === 0) {
    return { total: 0, filled: 0, percentage: 100 };
  }

  const otherErrors = validationErrors.filter(
    (e) => e.name !== "required"
  ).length;

  const filled = Math.max(0, total - missing - otherErrors);
  const percentage = Math.round((filled / total) * 100);
  return { total, filled, percentage };
}

// =============================================================================
// Variable Completion (dataset helper — kept separate from the main walk
// because variables use the polymorphic schema_class workaround)
// =============================================================================

/**
 * Count missing required fields for a single variable using its schema.
 */
export function countMissingVariableFields(
  variable: VariableFormData | FormDataRecord,
  rootSchema: RJSFSchema | JSONSchema
): number {
  const schemaKey = variable.schema_class as string | undefined;

  if (!schemaKey || !(rootSchema as JSONSchema).$defs) return 1; // No type = incomplete

  const schemaDef = (rootSchema as JSONSchema).$defs![schemaKey];
  if (!schemaDef) return 1; // Unknown schema_class = incomplete

  const variableSchema = resolveRef(schemaDef, rootSchema as JSONSchema);
  if (!variableSchema) return 0;

  // Count missing required fields across all accordion sections
  let missingCount = 0;

  for (const section of getAccordionConfig(schemaKey)) {
    for (const fieldEntry of section.fields) {
      const field = normalizeFieldConfig(fieldEntry);

      // Skip fields that don't exist in this schema
      if (
        !fieldExistsInSchema(
          field.path,
          variableSchema,
          rootSchema as JSONSchema
        )
      ) {
        continue;
      }

      // Check if field is required
      if (
        !isFieldRequired(field.path, variableSchema, rootSchema as JSONSchema)
      ) {
        continue;
      }

      // Check if field is missing
      const value = getNestedValue(variable, field.path);
      if (value === undefined || value === null || value === "") {
        missingCount++;
      }
    }
  }

  return missingCount;
}

/**
 * Count variables with incomplete required fields.
 */
export function countIncompleteVariables(
  datasetData: DatasetFormData | FormDataRecord | null | undefined,
  rootSchema: RJSFSchema | JSONSchema
): number {
  if (!datasetData) return 0;
  const variables = datasetData.variables as VariableFormData[] | undefined;
  if (!variables || !Array.isArray(variables)) return 0;

  let incomplete = 0;
  for (const variable of variables) {
    if (countMissingVariableFields(variable, rootSchema) > 0) {
      incomplete++;
    }
  }
  return incomplete;
}
