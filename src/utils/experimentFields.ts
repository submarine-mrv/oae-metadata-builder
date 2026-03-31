/**
 * Defines which fields belong to each experiment type
 * Used for cleaning form data when switching between types
 *
 * See docs/experiment-type-multi-select.md for schema selection rules.
 */

import type { FormDataRecord } from "@/types/forms";

// Fields present in the base Experiment class (shared by all types)
const BASE_EXPERIMENT_FIELDS = [
  "experiment_id",
  "experiment_types",
  "name",
  "description",
  "project_id",
  "start_datetime",
  "end_datetime",
  "spatial_coverage",
  "experiment_leads",
  "public_comments"
];

// Additional fields on InSituExperiment (field experiment types)
const IN_SITU_FIELDS = [
  "vertical_coverage",
  "permits",
  "meteorological_and_tidal_data",
  "data_conflicts_and_unreported_data",
  "additional_details"
];

// Intervention-specific fields
const INTERVENTION_FIELDS = [
  "alkalinity_dosing_effluent_density",
  "alkalinity_feedstock",
  "alkalinity_feedstock_co2_removal_potential",
  "alkalinity_feedstock_description",
  "alkalinity_feedstock_form",
  "alkalinity_feedstock_processing",
  "equilibration",
  "dosing_delivery_type",
  "dosing_depth",
  "dosing_description",
  "dosing_dispersal_hydrologic_location",
  "dosing_location",
  "dosing_regimen"
];

// Tracer-specific fields
const TRACER_FIELDS = [
  "tracer_concentration",
  "tracer_details",
  "tracer_form",
  "tracer_form_custom",
  "dosing_delivery_type",
  "dosing_depth",
  "dosing_description",
  "dosing_dispersal_hydrologic_location",
  "dosing_location",
  "dosing_regimen"
];

// Model-specific fields
const MODEL_FIELDS = [
  "grid_details",
  "input_details",
  "model_components",
  "model_configuration"
];

/**
 * Determines which schema class to use based on the selected experiment types.
 *
 * Rules (see docs/experiment-type-multi-select.md):
 * - model is exclusive — cannot combine with other types
 * - intervention + tracer_study → InterventionWithTracer (combined class)
 * - intervention alone → Intervention
 * - tracer_study alone → Tracer
 * - base types (baseline, control, other) → InSituExperiment
 */
export function getExperimentSchemaType(experimentType: string[]): string {
  const hasIntervention = experimentType.includes("intervention");
  const hasTracer = experimentType.includes("tracer_study");
  const hasModel = experimentType.includes("model");

  if (hasModel) return "model";
  if (hasIntervention && hasTracer) return "intervention_with_tracer";
  if (hasIntervention) return "intervention";
  if (hasTracer) return "tracer_study";
  return "in_situ";
}

/**
 * Enforces model exclusivity on the experiment_types array.
 * - If model was just added (not previously selected), remove all other types.
 * - If a non-model type was added while model was selected, remove model.
 */
export function enforceModelExclusivity(
  newTypes: string[],
  previousTypes: string[]
): string[] {
  const hadModel = previousTypes.includes("model");
  const hasModel = newTypes.includes("model");

  if (hasModel && !hadModel) {
    return ["model"];
  }
  if (hasModel && hadModel && newTypes.length > 1) {
    return newTypes.filter((t) => t !== "model");
  }
  return newTypes;
}

/**
 * Returns the set of valid fields for a given experiment type
 */
export function getValidFieldsForType(experimentType: string): Set<string> {
  const validFields = new Set(BASE_EXPERIMENT_FIELDS);

  switch (experimentType) {
    case "model":
      MODEL_FIELDS.forEach((field) => validFields.add(field));
      break;
    case "intervention":
      IN_SITU_FIELDS.forEach((field) => validFields.add(field));
      INTERVENTION_FIELDS.forEach((field) => validFields.add(field));
      break;
    case "tracer_study":
      IN_SITU_FIELDS.forEach((field) => validFields.add(field));
      TRACER_FIELDS.forEach((field) => validFields.add(field));
      break;
    case "intervention_with_tracer":
      IN_SITU_FIELDS.forEach((field) => validFields.add(field));
      INTERVENTION_FIELDS.forEach((field) => validFields.add(field));
      TRACER_FIELDS.forEach((field) => validFields.add(field));
      break;
    case "in_situ":
    case "control":
    case "baseline":
    case "other":
    default:
      IN_SITU_FIELDS.forEach((field) => validFields.add(field));
      break;
  }

  return validFields;
}

/**
 * Cleans form data to only include fields valid for the given experiment type
 * Removes fields that don't belong to the new type
 */
export function cleanFormDataForType<T extends FormDataRecord>(
  formData: T,
  experimentType: string
): Partial<T> {
  const validFields = getValidFieldsForType(experimentType);
  const cleanedData: Partial<T> = {};

  (Object.keys(formData) as Array<keyof T>).forEach((key) => {
    if (validFields.has(key as string)) {
      cleanedData[key] = formData[key];
    }
  });

  return cleanedData;
}
