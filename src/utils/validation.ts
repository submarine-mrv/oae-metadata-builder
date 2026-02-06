import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { RJSFValidationError } from "@rjsf/utils";
import {
  getProjectSchema,
  getExperimentSchema,
  getInterventionSchema,
  getTracerSchema,
  getInterventionWithTracerSchema,
  getDatasetSchema
} from "./schemaViews";
import type {
  ProjectFormData,
  ExperimentFormData,
  DatasetFormData,
  ExperimentState
} from "@/types/forms";

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

export interface ValidationResult {
  isValid: boolean;
  errors: RJSFValidationError[];
  errorCount: number;
}

/**
 * Validates project data against the project schema
 */
export function validateProject(projectData: ProjectFormData): ValidationResult {
  try {
    const schema = getProjectSchema();
    const result = validator.validateFormData(projectData, schema);

    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      errorCount: result.errors.length
    };
  } catch (error) {
    console.error("Error validating project:", error);
    return {
      isValid: false,
      errors: [],
      errorCount: 1
    };
  }
}

/**
 * Validates experiment data against the appropriate experiment schema
 * based on the experiment_type field
 */
export function validateExperiment(experimentData: ExperimentFormData): ValidationResult {
  try {
    // Select the appropriate schema based on experiment_type
    const experimentType = experimentData.experiment_type;
    let schema;

    if (experimentType === "intervention") {
      schema = getInterventionSchema();
    } else if (experimentType === "tracer_study") {
      schema = getTracerSchema();
    } else if (experimentType === "intervention_with_tracer") {
      schema = getInterventionWithTracerSchema();
    } else {
      // Use base Experiment schema for baseline, control, model, other
      schema = getExperimentSchema();
    }

    const result = validator.validateFormData(experimentData, schema);

    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      errorCount: result.errors.length
    };
  } catch (error) {
    console.error("Error validating experiment:", error);
    return {
      isValid: false,
      errors: [],
      errorCount: 1
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
    (e.params?.missingProperty === "experiment_id" ||
      e.property === ".experiment_id")
  );
}

/**
 * Validates dataset data against the dataset schema
 */
export function validateDataset(
  datasetData: DatasetFormData,
  options?: ValidateDatasetOptions
): ValidationResult {
  try {
    const schema = getDatasetSchema();
    const result = validator.validateFormData(datasetData, schema);

    let errors = result.errors;

    // Suppress experiment_id required error when no experiments exist
    if (options?.hasExperiments === false) {
      errors = errors.filter((e) => !isExperimentIdRequiredError(e));
    }

    return {
      isValid: errors.length === 0,
      errors,
      errorCount: errors.length
    };
  } catch (error) {
    console.error("Error validating dataset:", error);
    return {
      isValid: false,
      errors: [],
      errorCount: 1
    };
  }
}

/**
 * Validates all data (project + experiments) before export
 * Returns validation results for both project and experiments
 */
export function validateAllData(
  projectData: ProjectFormData,
  experiments: Array<Pick<ExperimentState, "id" | "name" | "formData">>
): {
  projectValidation: ValidationResult;
  experimentValidations: Map<number, ValidationResult>;
  isAllValid: boolean;
} {
  // Validate project
  const projectValidation = validateProject(projectData);

  // Validate all experiments
  const experimentValidations = new Map<number, ValidationResult>();

  for (const exp of experiments) {
    const validation = validateExperiment(exp.formData);
    experimentValidations.set(exp.id, validation);
  }

  // Check if everything is valid
  const allExperimentsValid = Array.from(experimentValidations.values()).every(
    (v) => v.isValid
  );
  const isAllValid = projectValidation.isValid && allExperimentsValid;

  return {
    projectValidation,
    experimentValidations,
    isAllValid
  };
}
