/**
 * Defines which fields belong to each experiment type
 * Used for cleaning form data when switching between types
 */

import type { FormDataRecord } from "@/types/forms";

// Fields present in the base Experiment class (shared by all types)
const BASE_EXPERIMENT_FIELDS = [
  "experiment_id",
  "experiment_type",
  "name",
  "description",
  "project_id",
  "start_datetime",
  "end_datetime",
  "spatial_coverage",
  "principal_investigators",
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
 * Derives the primary experiment type for schema/UI selection from the
 * (now multivalued) experiment_type array. Uses a priority order so that
 * the most field-rich schema is shown when multiple types are selected.
 */
export function getPrimaryExperimentType(experimentType: unknown): string | undefined {
  const types: string[] = Array.isArray(experimentType)
    ? experimentType
    : typeof experimentType === "string" && experimentType
      ? [experimentType]
      : [];

  if (types.length === 0) return undefined;

  if (types.includes("intervention") && types.includes("tracer_study")) {
    return "intervention_with_tracer";
  }

  const priority = [
    "intervention_with_tracer",
    "intervention",
    "tracer_study",
    "model"
  ];
  for (const t of priority) {
    if (types.includes(t)) return t;
  }

  return types[0];
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
    case "control":
    case "baseline":
    case "other":
    default:
      // InSituExperiment fields (field experiment types)
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

  // Keep only fields that are valid for this experiment type
  (Object.keys(formData) as Array<keyof T>).forEach((key) => {
    if (validFields.has(key as string)) {
      cleanedData[key] = formData[key];
    }
  });

  return cleanedData;
}
