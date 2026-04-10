/**
 * Defines which fields belong to each dataset type
 * Used for cleaning form data when switching between FieldDataset and ModelOutputDataset
 */

import type { FormDataRecord } from "@/types/forms";

// Fields present in the base Dataset class (shared by all types)
const BASE_DATASET_FIELDS = [
  "name",
  "description",
  "project_id",
  "experiment_id",
  "dataset_type",
  "dataset_type_custom",
  "data_submitter",
  "filenames",
  "author_list_for_citation",
  "license",
  "fair_use_data_request"
];

// FieldDataset-specific fields (not in ModelOutputDataset)
const FIELD_DATASET_FIELDS = [
  "platform_info",
  "calibration_files",
  "qc_flag_scheme",
  "data_product_type",
  "temporal_coverage",
  "variables"
];

// ModelOutputDataset-specific fields (not in FieldDataset)
const MODEL_SIMULATION_FIELDS = [
  "simulation_type",
  "mcdr_forcing_description",
  "model_output_variables",
  "output_frequency",
  "hardware_configuration",
  "start_datetime",
  "end_datetime"
];

/**
 * Returns the set of valid fields for a given dataset type
 */
export function getValidDatasetFieldsForType(datasetType: string): Set<string> {
  const validFields = new Set(BASE_DATASET_FIELDS);

  if (datasetType === "model_output") {
    MODEL_SIMULATION_FIELDS.forEach((field) => validFields.add(field));
  } else {
    FIELD_DATASET_FIELDS.forEach((field) => validFields.add(field));
  }

  return validFields;
}

/**
 * Cleans form data to only include fields valid for the given dataset type
 * Removes fields that don't belong to the new type
 */
export function cleanDatasetFormDataForType<T extends FormDataRecord>(
  formData: T,
  datasetType: string
): Partial<T> {
  const validFields = getValidDatasetFieldsForType(datasetType);
  const cleanedData: Partial<T> = {};

  (Object.keys(formData) as Array<keyof T>).forEach((key) => {
    if (validFields.has(key as string)) {
      cleanedData[key] = formData[key];
    }
  });

  return cleanedData;
}
