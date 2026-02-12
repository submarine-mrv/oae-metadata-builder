// completionCalculator.ts - Calculate form completion percentages and missing field counts

import type {
  FormDataRecord,
  ProjectFormData,
  ExperimentFormData,
  DatasetFormData,
  VariableFormData
} from "@/types/forms";
import type { RJSFSchema } from "@rjsf/utils";
import {
  getSchemaKey,
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

// Define required fields for different form types
const REQUIRED_FIELDS_MAP = {
  project: [
    "project_id",
    "description",
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
    "principal_investigators",
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
  formData: ExperimentFormData | FormDataRecord | null | undefined,
  experimentType?: string
): number {
  if (!formData || Object.keys(formData).length === 0) return 0;

  const requiredFields = getRequiredFieldsForType(experimentType);

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
export function calculateProjectCompletion(
  projectData: ProjectFormData | FormDataRecord | null | undefined
): number {
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

// =============================================================================
// Schema-Driven Missing Field Count Functions (for Download Modal)
// =============================================================================

/**
 * Check if a primitive field value is considered "filled"
 * For objects, we check recursively via countMissingRequiredFieldsRecursive
 */
function isPrimitiveFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  return false;
}

/**
 * Check if an array field is considered "filled"
 */
function isArrayFilled(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.length > 0;
}

/**
 * Resolve a property schema, handling $ref if present
 */
function resolvePropertySchema(
  propSchema: JSONSchema | undefined,
  rootSchema: JSONSchema
): JSONSchema | undefined {
  if (!propSchema) return undefined;

  // Handle $ref
  if (propSchema.$ref) {
    const resolved = resolveRef(propSchema, rootSchema);
    return resolved || undefined;
  }

  return propSchema;
}

/**
 * Get the schema type, handling type arrays like ["string", "null"]
 */
function getSchemaType(schema: JSONSchema): string | undefined {
  if (!schema.type) return undefined;
  if (Array.isArray(schema.type)) {
    // Return the first non-null type
    return schema.type.find((t) => t !== "null");
  }
  return schema.type as string;
}

/**
 * Recursively count missing required fields in form data based on schema.
 * This walks through nested objects and checks their required fields too.
 *
 * @param data - The form data to check
 * @param schema - The schema for this data (already resolved, not a $ref)
 * @param rootSchema - The root schema containing $defs
 * @param skipFields - Optional set of field names to skip (e.g., "variables" handled separately)
 */
function countMissingRequiredFieldsRecursive(
  data: FormDataRecord | null | undefined,
  schema: JSONSchema,
  rootSchema: JSONSchema,
  skipFields?: Set<string>
): number {
  let missing = 0;

  const requiredFields = schema.required || [];
  const properties = schema.properties || {};

  for (const fieldName of requiredFields) {
    // Skip fields we're handling separately
    if (skipFields?.has(fieldName)) continue;

    const propSchema = resolvePropertySchema(
      properties[fieldName] as JSONSchema | undefined,
      rootSchema
    );
    const value = data?.[fieldName];

    if (!propSchema) {
      // No schema for this field, just check if value exists
      if (!isPrimitiveFilled(value)) {
        missing++;
      }
      continue;
    }

    const schemaType = getSchemaType(propSchema);

    if (schemaType === "array") {
      // For arrays, just check if non-empty
      if (!isArrayFilled(value)) {
        missing++;
      }
      // Note: We don't recursively check array items here
      // Variables are handled separately via countIncompleteVariables
    } else if (schemaType === "object" || propSchema.properties) {
      // For objects, check if the object exists and has required fields filled
      if (value === undefined || value === null) {
        // Object is completely missing - count as 1 missing field
        // (the parent required field itself)
        missing++;
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Object exists - recursively check its required fields
        missing += countMissingRequiredFieldsRecursive(
          value as FormDataRecord,
          propSchema,
          rootSchema
        );
      }
    } else {
      // Primitive type - check if filled
      if (!isPrimitiveFilled(value)) {
        missing++;
      }
    }
  }

  return missing;
}

/**
 * Count missing required fields for any form data using its schema.
 * Recursively checks nested objects.
 *
 * @param data - The form data to check
 * @param schema - The schema for this data (from getDatasetSchema, getProjectSchema, etc.)
 * @param skipFields - Optional array of field names to skip (e.g., ["variables"])
 */
export function countMissingRequiredFields(
  data: FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema,
  skipFields?: string[]
): number {
  if (!schema) return 0;

  const skipSet = skipFields ? new Set(skipFields) : undefined;

  return countMissingRequiredFieldsRecursive(
    data,
    schema as JSONSchema,
    schema as JSONSchema,
    skipSet
  );
}

/**
 * Count missing required fields for dataset data (excluding variables)
 * Variables are counted separately via countIncompleteVariables
 * Also excludes project_id and experiment_id which are auto-managed
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
 * Count missing required fields for project data
 */
export function countMissingProjectFields(
  projectData: ProjectFormData | FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema
): number {
  return countMissingRequiredFields(projectData, schema);
}

/**
 * Count missing required fields for experiment data
 * Excludes project_id which is auto-managed
 */
export function countMissingExperimentFields(
  experimentData: ExperimentFormData | FormDataRecord | null | undefined,
  schema: RJSFSchema | JSONSchema
): number {
  return countMissingRequiredFields(experimentData, schema, ["project_id"]);
}

/**
 * Count missing required fields for a single variable using its schema
 */
export function countMissingVariableFields(
  variable: VariableFormData | FormDataRecord,
  rootSchema: RJSFSchema | JSONSchema
): number {
  // Get schema key from variable's type selections
  const schemaKey = getSchemaKey(
    variable._variableType as string | undefined,
    variable.genesis as string | undefined,
    variable.sampling as string | undefined
  );

  if (!schemaKey || !(rootSchema as JSONSchema).$defs) return 0;

  const variableSchema = resolveRef(
    (rootSchema as JSONSchema).$defs![schemaKey],
    rootSchema as JSONSchema
  );
  if (!variableSchema) return 0;

  // Count missing required fields across all accordion sections
  let missingCount = 0;

  for (const section of getAccordionConfig(schemaKey)) {
    for (const fieldEntry of section.fields) {
      const field = normalizeFieldConfig(fieldEntry);

      // Skip fields that don't exist in this schema
      if (!fieldExistsInSchema(field.path, variableSchema, rootSchema as JSONSchema)) {
        continue;
      }

      // Check if field is required
      if (!isFieldRequired(field.path, variableSchema, rootSchema as JSONSchema)) {
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
 * Count variables with incomplete required fields
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
