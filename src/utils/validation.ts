import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { RJSFValidationError } from "@rjsf/utils";

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
export async function validateProject(
  projectData: any
): Promise<ValidationResult> {
  try {
    const response = await fetch("/schema.bundled.json");
    const schema = await response.json();

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
export async function validateExperiment(
  experimentData: any
): Promise<ValidationResult> {
  try {
    const response = await fetch("/experiment.schema.bundled.json");
    const baseSchema = await response.json();

    // Select the appropriate schema based on experiment_type
    let schema;
    const experimentType = experimentData.experiment_type;

    if (experimentType === "intervention") {
      // Use Intervention schema from $defs
      schema = {
        ...baseSchema.$defs.Intervention,
        $defs: baseSchema.$defs,
        $schema: baseSchema.$schema,
        $id: "InterventionSchema",
        additionalProperties: true
      };
    } else if (experimentType === "tracer_study") {
      // Use Tracer schema from $defs
      schema = {
        ...baseSchema.$defs.Tracer,
        $defs: baseSchema.$defs,
        $schema: baseSchema.$schema,
        $id: "TracerSchema",
        additionalProperties: true
      };
    } else if (experimentType === "intervention_with_tracer") {
      // Use InterventionWithTracer schema from $defs
      schema = {
        ...baseSchema.$defs.InterventionWithTracer,
        $defs: baseSchema.$defs,
        $schema: baseSchema.$schema,
        $id: "InterventionWithTracerSchema",
        additionalProperties: true
      };
    } else {
      // Use base Experiment schema for baseline, control, model, other
      schema = baseSchema;
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

/**
 * Validates all data (project + experiments) before export
 * Returns validation results for both project and experiments
 */
export async function validateAllData(
  projectData: any,
  experiments: Array<{ id: number; name: string; formData: any }>
): Promise<{
  projectValidation: ValidationResult;
  experimentValidations: Map<number, ValidationResult>;
  isAllValid: boolean;
}> {
  // Validate project
  const projectValidation = await validateProject(projectData);

  // Validate all experiments
  const experimentValidations = new Map<number, ValidationResult>();

  for (const exp of experiments) {
    const validation = await validateExperiment(exp.formData);
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
