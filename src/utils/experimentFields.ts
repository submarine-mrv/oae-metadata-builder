/**
 * Defines which fields belong to each experiment type
 * Used for cleaning form data when switching between types
 */

import type { FormDataRecord } from "@/types/forms";

// Common fields present in all experiment types
const COMMON_FIELDS = [
  "experiment_id",
  "experiment_type",
  "name",
  "description",
  "project_id",
  "start_datetime",
  "end_datetime",
  "spatial_coverage",
  "vertical_coverage",
  "principal_investigators",
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
  "dosing_delivery_type",
  "dosing_depth",
  "dosing_description",
  "dosing_dispersal_hydrologic_location",
  "dosing_location",
  "dosing_regimen"
];

/**
 * Returns the set of valid fields for a given experiment type
 */
export function getValidFieldsForType(experimentType: string): Set<string> {
  const validFields = new Set(COMMON_FIELDS);

  switch (experimentType) {
    case "intervention":
      INTERVENTION_FIELDS.forEach((field) => validFields.add(field));
      break;
    case "tracer_study":
      TRACER_FIELDS.forEach((field) => validFields.add(field));
      break;
    case "intervention_with_tracer":
      INTERVENTION_FIELDS.forEach((field) => validFields.add(field));
      TRACER_FIELDS.forEach((field) => validFields.add(field));
      break;
    case "control":
    case "baseline":
    case "model":
    case "other":
      // Only common fields
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
