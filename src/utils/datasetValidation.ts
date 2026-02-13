/**
 * Dataset Validation with Variable Workaround
 *
 * ============================================================================
 * TEMPORARY WORKAROUND - See beads issue: oae-form-99i
 * Also related: oae-form-c0s, GitHub submarine-mrv/oae-data-commons#47
 * ============================================================================
 *
 * ## Why This Exists
 *
 * Variables in the Dataset use polymorphic types (e.g., DiscretePHVariable,
 * ContinuousSalinityVariable). The base Variable schema has `additionalProperties: false`,
 * which causes type-specific fields (like pH calibration) to fail validation.
 *
 * We disabled `include_range_class_descendants` in LinkML to fix form rendering,
 * but this broke schema-level validation for polymorphic types.
 *
 * ## The Workaround
 *
 * 1. Skip the `variables` array when validating the dataset against the schema
 * 2. Validate each variable individually using its `_schemaKey` field to select
 *    the correct type-specific schema from $defs
 *
 * ## When to Remove
 *
 * This workaround should be removed when oae-form-c0s is complete:
 * - LinkML has `type_designator` support with `variable_type` field
 * - Two-schema approach implemented (form schema vs validation schema)
 * - Proper polymorphic validation via JSON Schema discriminator
 *
 * At that point, we can use standard RJSF/Ajv validation for the entire dataset
 * including variables, and delete this file.
 */

import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { RJSFValidationError, RJSFSchema } from "@rjsf/utils";
import { getSchemaKey } from "@/components/VariableModal/variableModalConfig";
import { resolveRef, type JSONSchema } from "@/components/schemaUtils";
import type { DatasetFormData, FormDataRecord } from "@/types/forms";

// Create validator with Draft 2019-09 support (same as rest of app)
const validator = customizeValidator({ AjvClass: Ajv2019 });

// =============================================================================
// Types
// =============================================================================

export interface VariableValidationError {
  /** Index of the variable in the variables array */
  index: number;
  /** Name of the variable for display purposes */
  variableName: string;
  /** List of error messages for this variable */
  errors: string[];
}

export interface DatasetValidationResult {
  /** Whether the entire dataset (including variables) is valid */
  isValid: boolean;

  /**
   * Errors from dataset-level field validation (NOT including variables).
   * These are standard RJSF validation errors that can be displayed in the form.
   */
  datasetErrors: RJSFValidationError[];

  /**
   * Per-variable validation errors.
   * Key is the variable index, value contains error details.
   *
   * WORKAROUND: This uses _schemaKey to validate each variable against its
   * specific type schema. See file header for details.
   */
  variableErrors: Map<number, VariableValidationError>;

  /** Total count of dataset-level errors */
  datasetErrorCount: number;

  /** Count of variables with validation errors */
  invalidVariableCount: number;
}

// =============================================================================
// Dataset-Level Validation (excluding variables)
// =============================================================================

/**
 * Creates a modified schema that doesn't require the 'variables' field.
 * This allows us to validate dataset-level fields without triggering
 * polymorphism issues in the variables array.
 *
 * WORKAROUND: See oae-form-99i
 */
function createDatasetSchemaWithoutVariables(schema: RJSFSchema): RJSFSchema {
  const modifiedSchema = { ...schema };

  // Remove 'variables' from required array if present
  if (Array.isArray(modifiedSchema.required)) {
    modifiedSchema.required = modifiedSchema.required.filter(
      (field) => field !== "variables"
    );
  }

  // Make variables property accept anything (avoid validation)
  if (modifiedSchema.properties && "variables" in modifiedSchema.properties) {
    modifiedSchema.properties = {
      ...modifiedSchema.properties,
      variables: { type: "array" } // Accept any array, don't validate items
    };
  }

  return modifiedSchema;
}

/**
 * Validates dataset-level fields (everything except variables).
 */
function validateDatasetFields(
  formData: DatasetFormData,
  schema: RJSFSchema
): RJSFValidationError[] {
  const modifiedSchema = createDatasetSchemaWithoutVariables(schema);

  // Create a copy of formData without variables for validation
  // This prevents any variable-related errors from appearing
  const dataWithoutVariables = { ...formData };
  delete dataWithoutVariables.variables;

  const result = validator.validateFormData(dataWithoutVariables, modifiedSchema);
  return result.errors;
}

// =============================================================================
// Per-Variable Validation
// =============================================================================

/**
 * Validates a single variable against its type-specific schema.
 *
 * WORKAROUND: Uses the `_schemaKey` field (e.g., "DiscretePHVariable") to
 * look up the correct schema from $defs. This is a temporary solution until
 * proper polymorphism support via LinkML type_designator (oae-form-c0s).
 *
 * @param variable - The variable data to validate
 * @param rootSchema - The root schema containing $defs
 * @returns Array of error messages, empty if valid
 */
function validateVariable(
  variable: FormDataRecord,
  rootSchema: JSONSchema
): string[] {
  const errors: string[] = [];

  // Get the schema key from the variable's type selections
  const schemaKey = getSchemaKey(
    variable._variableType as string | undefined,
    variable.genesis as string | undefined,
    variable.sampling as string | undefined
  );

  if (!schemaKey) {
    // Can't validate without knowing the type
    errors.push("Variable type not fully specified");
    return errors;
  }

  if (!rootSchema.$defs || !rootSchema.$defs[schemaKey]) {
    errors.push(`Unknown variable schema: ${schemaKey}`);
    return errors;
  }

  // Resolve the schema for this variable type
  const variableSchema = resolveRef(
    rootSchema.$defs[schemaKey],
    rootSchema
  );

  if (!variableSchema) {
    errors.push(`Could not resolve schema for: ${schemaKey}`);
    return errors;
  }

  // Build a complete schema with $defs for validation
  // Type assertion needed due to JSONSchema vs RJSFSchema type incompatibility
  // Our internal JSONSchema type uses string for 'type' but RJSF expects JSONSchema7TypeName
  const completeSchema = {
    ...variableSchema,
    $defs: rootSchema.$defs
  } as RJSFSchema;

  // Only keep fields that exist in the target schema.
  // This strips UI-only fields (_variableType, _schemaKey) AND fields from
  // the type selection that don't belong in this variable type — e.g. genesis
  // and sampling exist in MeasuredVariable schemas but not in CalculatedVariable
  // or NonMeasuredVariable, which have additionalProperties: false.
  const schemaProps = new Set(Object.keys(variableSchema.properties || {}));
  const cleanedVariable = Object.fromEntries(
    Object.entries(variable).filter(([key]) => schemaProps.has(key))
  );

  // Validate the variable against its specific schema
  const result = validator.validateFormData(cleanedVariable, completeSchema);

  // Convert RJSF errors to simple messages
  result.errors.forEach((error) => {
    const field = error.property?.replace(/^\./, "") || "unknown field";
    const message = error.message || "validation error";
    errors.push(`${field}: ${message}`);
  });

  return errors;
}

/**
 * Validates all variables in a dataset.
 *
 * WORKAROUND: See oae-form-99i for why we validate variables individually
 * instead of relying on the schema's array validation.
 */
function validateAllVariables(
  formData: DatasetFormData,
  rootSchema: JSONSchema
): Map<number, VariableValidationError> {
  const variableErrors = new Map<number, VariableValidationError>();

  const variables = formData.variables as FormDataRecord[] | undefined;
  if (!variables || !Array.isArray(variables)) {
    return variableErrors;
  }

  variables.forEach((variable, index) => {
    const errors = validateVariable(variable, rootSchema);

    if (errors.length > 0) {
      variableErrors.set(index, {
        index,
        variableName:
          (variable.dataset_variable_name as string) ||
          (variable.long_name as string) ||
          `Variable ${index + 1}`,
        errors
      });
    }
  });

  return variableErrors;
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validates a dataset including all its variables.
 *
 * This is the main entry point for dataset validation. It handles the
 * polymorphism workaround by:
 * 1. Validating dataset-level fields against a modified schema (variables skipped)
 * 2. Validating each variable individually against its _schemaKey schema
 *
 * ============================================================================
 * WORKAROUND: See beads issue oae-form-99i
 *
 * This approach is necessary because:
 * - Variables use polymorphic types (DiscretePHVariable, ContinuousPHVariable, etc.)
 * - The base Variable schema has additionalProperties: false
 * - Type-specific fields fail validation against the base schema
 *
 * Remove this workaround when oae-form-c0s is complete (proper polymorphism).
 * ============================================================================
 *
 * @param formData - The dataset form data to validate
 * @param schema - The dataset schema (should have $defs with variable types)
 * @returns Validation result with dataset errors and per-variable errors
 */
export function validateDatasetWithVariables(
  formData: DatasetFormData,
  schema: RJSFSchema
): DatasetValidationResult {
  // 1. Validate dataset-level fields (skip variables)
  const datasetErrors = validateDatasetFields(formData, schema);

  // 2. Validate each variable individually using its _schemaKey
  const variableErrors = validateAllVariables(formData, schema as JSONSchema);

  return {
    isValid: datasetErrors.length === 0 && variableErrors.size === 0,
    datasetErrors,
    variableErrors,
    datasetErrorCount: datasetErrors.length,
    invalidVariableCount: variableErrors.size
  };
}

/**
 * Quick check if a dataset has any validation errors.
 * Use this for UI indicators (badges, warnings) without full error details.
 *
 * WORKAROUND: See oae-form-99i
 */
export function hasDatasetValidationErrors(
  formData: DatasetFormData,
  schema: RJSFSchema
): boolean {
  const result = validateDatasetWithVariables(formData, schema);
  return !result.isValid;
}

/**
 * Get validation error counts for display purposes.
 *
 * WORKAROUND: See oae-form-99i
 */
export function getDatasetValidationCounts(
  formData: DatasetFormData,
  schema: RJSFSchema
): { datasetErrors: number; variableErrors: number; total: number } {
  const result = validateDatasetWithVariables(formData, schema);
  return {
    datasetErrors: result.datasetErrorCount,
    variableErrors: result.invalidVariableCount,
    total: result.datasetErrorCount + result.invalidVariableCount
  };
}
