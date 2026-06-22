import type { RJSFValidationError } from "@rjsf/utils";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { DatasetFormData, ExperimentFormData, ProjectFormData } from "@/types/forms";
import { experimentCustomValidate, projectCustomValidate } from "./customValidators";
import { getExperimentSchemaType } from "./experimentFields";
import {
  getFieldDatasetSchema,
  getInSituExperimentSchema,
  getInterventionSchema,
  getInterventionWithTracerSchema,
  getModelOutputDatasetSchema,
  getModelSchema,
  getProjectSchema,
  getTracerSchema,
} from "./schemaViews";

// Create validator with Draft 2019-09 support. `discriminator: true` lets AJV
// route each polymorphic variable to its schema_class branch (oneOf +
// discriminator) and report branch-targeted errors. Harmless for schemas
// without a discriminator keyword (project, experiment). `discriminator` is an
// OpenAPI/AJV extension; its standards-track long-term replacement is JSON Schema
// `propertyDependencies` (JSON Schema v1, ~2026) — full rationale in
// scripts/bundle-schema.mjs.
const validator = customizeValidator({
  AjvClass: Ajv2019,
  ajvOptionsOverrides: { discriminator: true },
});

export interface ValidationResult {
  isValid: boolean;
  errors: RJSFValidationError[];
  errorCount: number;
  /**
   * Per-variable errors keyed by index in the dataset's `variables` array,
   * grouped from the single validation pass. Only populated by validateDataset.
   * An index absent from the map means that variable has no errors. This is the
   * one source the badge, the overview check, and the variable-table (!) all read.
   */
  errorsByVariableIndex?: Map<number, RJSFValidationError[]>;
}

// =============================================================================
// Schema Selection Helpers
// =============================================================================
// Exported so the completion calculator uses the same schema the validator
// sees — keeps them in sync automatically.

/**
 * Returns the experiment schema that matches the given form data's
 * experiment_types selection.
 */
export function getExperimentSchemaForData(
  experimentData: ExperimentFormData,
): ReturnType<typeof getInSituExperimentSchema> {
  const schemaType = getExperimentSchemaType(experimentData.experiment_types ?? []);
  if (schemaType === "intervention") return getInterventionSchema();
  if (schemaType === "tracer_study") return getTracerSchema();
  if (schemaType === "intervention_with_tracer") return getInterventionWithTracerSchema();
  if (schemaType === "model") return getModelSchema();
  return getInSituExperimentSchema();
}

/**
 * Returns the dataset schema that matches the given form data's
 * dataset_type selection.
 */
export function getDatasetSchemaForData(
  datasetData: DatasetFormData,
): ReturnType<typeof getFieldDatasetSchema> {
  return datasetData.dataset_type === "model_output"
    ? getModelOutputDatasetSchema()
    : getFieldDatasetSchema();
}

/**
 * Validates project data against the project schema
 */
export function validateProject(projectData: ProjectFormData): ValidationResult {
  try {
    const schema = getProjectSchema();
    // Pass the same customValidate the form uses so badge counts include
    // cross-field rules (vertical coverage, temporal ordering).
    const result = validator.validateFormData(projectData, schema, projectCustomValidate);

    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      errorCount: result.errors.length,
    };
  } catch (error) {
    console.error("Error validating project:", error);
    return {
      isValid: false,
      errors: [],
      errorCount: 1,
    };
  }
}

/**
 * Validates experiment data against the appropriate experiment schema
 * based on the experiment_types field
 */
export function validateExperiment(experimentData: ExperimentFormData): ValidationResult {
  try {
    const schema = getExperimentSchemaForData(experimentData);

    // Pass the same customValidate the form uses so badge counts include
    // cross-field rules (vertical coverage).
    const result = validator.validateFormData(experimentData, schema, experimentCustomValidate);

    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      errorCount: result.errors.length,
    };
  } catch (error) {
    console.error("Error validating experiment:", error);
    return {
      isValid: false,
      errors: [],
      errorCount: 1,
    };
  }
}

interface ValidateDatasetOptions {
  /** When false, experiment_id required errors are suppressed */
  hasExperiments?: boolean;
}

function isExperimentIdRequiredError(e: RJSFValidationError): boolean {
  return (
    e.name === "required" &&
    (e.params?.missingProperty === "experiment_id" || e.property === ".experiment_id")
  );
}

/**
 * Re-labels an AJV error that lands inside the `variables` array into the
 * "Variable '<name>': <message>" form the dataset UI expects, so the error list
 * groups problems by variable. Non-variable errors pass through unchanged.
 */
function relabelVariableError(
  e: RJSFValidationError,
  datasetData: DatasetFormData,
): RJSFValidationError {
  const prop = e.property ?? "";
  const match = /^\.variables(?:\.|\[)(\d+)\]?(.*)$/.exec(prop);
  if (!match) return e;

  const index = Number(match[1]);
  // Required errors already path the field (".variables.0.measurement_temperature").
  let fieldPath = match[2] ?? "";
  // additionalProperties errors report on the parent object — the offending key
  // is in params, not the path — so append it.
  if (e.name === "additionalProperties") {
    const extra = (e.params as { additionalProperty?: string } | undefined)?.additionalProperty;
    if (extra) fieldPath = fieldPath ? `${fieldPath}.${extra}` : `.${extra}`;
  }

  const variables = datasetData.variables as Array<Record<string, unknown>> | undefined;
  const variable = variables?.[index];
  const variableName =
    (variable?.dataset_variable_name as string) ||
    (variable?.long_name as string) ||
    `Variable ${index + 1}`;

  const field = fieldPath.replace(/^\./, "");
  const baseMessage = e.message ?? "is invalid";
  const message = field
    ? `Variable '${variableName}': ${field}: ${baseMessage}`
    : `Variable '${variableName}': ${baseMessage}`;

  // name "variable" matches the contract the dataset page relies on: it injects
  // only `name === "variable"` errors and excludes them from the required-error
  // hide-filter and the missing-required count.
  return { ...e, name: "variable", property: `.variables[${index}]`, message };
}

/**
 * Validates dataset data — including its polymorphic variables — in a single AJV
 * pass. The bundled schema discriminates `variables` on `schema_class`, so AJV
 * validates each variable against exactly its type and reports branch-targeted
 * errors, which are re-labeled per variable for the UI.
 */
export function validateDataset(
  datasetData: DatasetFormData,
  options?: ValidateDatasetOptions,
): ValidationResult {
  try {
    const schema = getDatasetSchemaForData(datasetData);
    const result = validator.validateFormData(datasetData, schema);

    let errors = result.errors.map((e) => relabelVariableError(e, datasetData));

    // Catch empty/missing experiment_id that JSON schema "required" may not flag.
    // Scenarios: propagation sets "" or undefined while property key still exists in object.
    // Only add the error if AJV didn't already generate one for experiment_id.
    const experimentId = datasetData.experiment_id as string | undefined;
    const hasExperimentIdError = errors.some((e) => isExperimentIdRequiredError(e));
    if (!hasExperimentIdError && (!experimentId || experimentId.trim() === "")) {
      errors = [
        ...errors,
        {
          name: "required",
          property: ".experiment_id",
          message: "is a required property",
          params: { missingProperty: "experiment_id" },
          stack: ".experiment_id is a required property",
          schemaPath: "#/required",
        },
      ];
    }

    // Suppress experiment_id required error when no experiments exist
    if (options?.hasExperiments === false) {
      errors = errors.filter((e) => !isExperimentIdRequiredError(e));
    }

    // Group per-variable errors by index from this same pass, so the variable
    // table's (!) indicator derives from the same validation as the badge.
    const errorsByVariableIndex = new Map<number, RJSFValidationError[]>();
    for (const e of errors) {
      const match = /^\.variables\[(\d+)\]/.exec(e.property ?? "");
      if (!match) continue;
      const i = Number(match[1]);
      const list = errorsByVariableIndex.get(i) ?? [];
      list.push(e);
      errorsByVariableIndex.set(i, list);
    }

    const errorCount = errors.length;

    return {
      isValid: errorCount === 0,
      errors,
      errorCount,
      errorsByVariableIndex,
    };
  } catch (error) {
    console.error("Error validating dataset:", error);
    return {
      isValid: false,
      errors: [],
      errorCount: 1,
    };
  }
}
