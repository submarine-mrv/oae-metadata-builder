// completionCalculator.ts - Calculate form completion percentages

// Define required fields for different form types
const REQUIRED_FIELDS_MAP = {
  project: [
    "project_id",
    "project_description",
    "mcdr_pathway",
    "sea_names",
    "spatial_coverage",
    "temporal_coverage"
  ],
  experiment_base: [
    "experiment_id",
    "experiment_type",
    "description",
    "spatial_coverage",
    "vertical_coverage",
    "investigators",
    "start_datetime",
    "end_datetime"
  ],
  intervention: [
    "alkalinity_feedstock_processing",
    "alkalinity_feedstock_form",
    "alkalinity_feedstock",
    "alkalinity_feedstock_description",
    "equilibration",
    "dosing_location",
    "dosing_dispersal_hydrologic_location",
    "dosing_delivery_type",
    "alkalinity_dosing_effluent_density",
    "dosing_depth",
    "dosing_description",
    "dosing_regimen",
    "dosing_data"
  ],
  tracer: [
    "tracer_concentration",
    "tracer_details",
    "tracer_form",
    "dosing_delivery_type",
    "dosing_depth",
    "dosing_description",
    "dosing_dispersal_hydrologic_location",
    "dosing_location",
    "dosing_regimen"
  ]
};

/**
 * Get required fields for a given experiment type
 * @param experimentType - Type of experiment
 * @returns Array of required field names
 */
function getRequiredFieldsForType(experimentType?: string): string[] {
  const baseFields = REQUIRED_FIELDS_MAP.experiment_base;

  switch (experimentType) {
    case "intervention":
      return [...baseFields, ...REQUIRED_FIELDS_MAP.intervention];
    case "tracer_study":
      return [...baseFields, ...REQUIRED_FIELDS_MAP.tracer];
    case "intervention_with_tracer":
      return [
        ...baseFields,
        ...REQUIRED_FIELDS_MAP.intervention,
        ...REQUIRED_FIELDS_MAP.tracer
      ];
    default:
      return baseFields;
  }
}

/**
 * Calculate completion percentage for form data
 * @param formData - Form data object
 * @param experimentType - Optional experiment type for type-specific fields
 * @returns Completion percentage (0-100)
 */
export function calculateFormCompletion(
  formData: any,
  experimentType?: string
): number {
  if (!formData || Object.keys(formData).length === 0) return 0;

  const requiredFields = experimentType
    ? getRequiredFieldsForType(experimentType)
    : Object.keys(formData);

  let filledFields = 0;

  requiredFields.forEach((field) => {
    const value = formData[field];
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value) && value.length > 0) {
        filledFields++;
      } else if (typeof value === "object" && Object.keys(value).length > 0) {
        filledFields++;
      } else if (typeof value === "string" && value.trim() !== "") {
        filledFields++;
      } else if (typeof value === "number") {
        filledFields++;
      }
    }
  });

  return Math.round((filledFields / requiredFields.length) * 100);
}

/**
 * Calculate project completion percentage
 * @param projectData - Project form data
 * @returns Completion percentage (0-100)
 */
export function calculateProjectCompletion(projectData: any): number {
  if (!projectData || Object.keys(projectData).length === 0) return 0;

  const requiredFields = REQUIRED_FIELDS_MAP.project;
  let filledFields = 0;

  requiredFields.forEach((field) => {
    const value = projectData[field];
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value) && value.length > 0) {
        filledFields++;
      } else if (typeof value === "object" && Object.keys(value).length > 0) {
        filledFields++;
      } else if (typeof value === "string" && value.trim() !== "") {
        filledFields++;
      } else if (typeof value === "number") {
        filledFields++;
      }
    }
  });

  return Math.round((filledFields / requiredFields.length) * 100);
}
