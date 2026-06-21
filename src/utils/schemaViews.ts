/**
 * Schema view utilities for creating RJSF schemas from the base Container schema.
 *
 * The base schema has Container as the root, but our forms need specific views
 * (Project, Experiment, Intervention, etc.). These utilities extract the relevant
 * schema definition and preserve metadata like protocol version and git hash.
 */

import type { RJSFSchema } from "@rjsf/utils";
import baseSchema from "@/schema/schema.bundled.json";

/**
 * Gets the base Container schema with all definitions and metadata
 */
export function getBaseSchema() {
  return baseSchema;
}

/**
 * Gets protocol version metadata from the schema
 */
export function getProtocolMetadata() {
  return {
    version: baseSchema["x-protocol-version"] || "",
    gitHash: baseSchema["x-protocol-git-hash"] || "",
  };
}

/**
 * Creates a schema view by extracting a definition from $defs and
 * making it the root schema while preserving all $defs and metadata.
 *
 * @param defName - The name of the definition in $defs
 * @param schemaId - The $id to assign to the schema view
 * @param hasConditionalFields - If true, sets additionalProperties: true which is
 *   required for allOf/if/then conditionals to work. Only set this for schemas
 *   that have conditional fields (e.g., Intervention), as it causes RJSF to
 *   render nested object properties as additional properties.
 */
function createSchemaView(
  defName: string,
  schemaId: string,
  hasConditionalFields = false,
): RJSFSchema {
  const def = (baseSchema as any).$defs?.[defName];

  if (!def) {
    throw new Error(`${defName} definition not found in schema`);
  }

  // Cast to unknown first, then to RJSFSchema - needed because the JSON import
  // has very specific types that are structurally incompatible with JSONSchema7
  //
  // Only copy allOf/if/then/else when they're actually defined on the def.
  // Setting them to `undefined` still creates the property key, which makes
  // RJSF's `'if' in schema` check succeed and pass `undefined` into
  // resolveCondition → validator.isValid → crash on `schema.$id`.
  const view: Record<string, unknown> = {
    ...baseSchema,
    $id: schemaId,
    title: def.title,
    description: def.description,
    properties: def.properties,
    required: def.required,
    // Only set additionalProperties: true for schemas with allOf/if/then conditionals.
    // This is required for conditional fields to render, but causes issues with
    // nested object properties being rendered as additional properties.
    additionalProperties: hasConditionalFields ? true : def.additionalProperties,
  };
  if (def.allOf !== undefined) view.allOf = def.allOf;
  if (def.if !== undefined) view.if = def.if;
  // biome-ignore lint/suspicious/noThenProperty: JSON Schema "then" keyword, not a PromiseLike
  if (def.then !== undefined) view.then = def.then;
  if (def.else !== undefined) view.else = def.else;
  return view as unknown as RJSFSchema;
}

/**
 * Gets the Project schema for the project form
 */
export function getProjectSchema() {
  return createSchemaView("Project", "ProjectSchema");
}

/**
 * Gets the Experiment schema for the experiment form
 */
export function getExperimentSchema() {
  return createSchemaView("Experiment", "ExperimentSchema");
}

/**
 * Gets the Intervention schema for intervention-type experiments.
 * Has conditional fields (allOf/if/then) so needs additionalProperties: true.
 */
export function getInterventionSchema() {
  return createSchemaView("Intervention", "InterventionSchema", true);
}

/**
 * Gets the Tracer schema for tracer-type experiments
 */
export function getTracerSchema() {
  return createSchemaView("Tracer", "TracerSchema");
}

/**
 * Gets the InterventionWithTracer schema.
 * Has conditional fields (allOf/if/then) so needs additionalProperties: true.
 */
export function getInterventionWithTracerSchema() {
  return createSchemaView("InterventionWithTracer", "InterventionWithTracerSchema", true);
}

/**
 * Gets the InSituExperiment schema for field experiment types
 * (baseline, control, other). Has the field-specific fields like
 * vertical_coverage, permits, meteorological_and_tidal_data that
 * moved from Experiment to InSituExperiment in the schema refactor.
 */
export function getInSituExperimentSchema() {
  return createSchemaView("InSituExperiment", "InSituExperimentSchema");
}

/**
 * Gets the Model schema for model-type experiments.
 * Has model-specific fields: grid_details, model_components,
 * input_details, model_configuration.
 */
export function getModelSchema() {
  return createSchemaView("Model", "ModelSchema");
}

/**
 * Gets the Dataset schema for the dataset form (base class)
 */
export function getDatasetSchema() {
  return createSchemaView("Dataset", "DatasetSchema");
}

/**
 * Gets the FieldDataset schema for field dataset types.
 * Has field-specific fields: platform_info, temporal_coverage,
 * variables, calibration_files, qc_flag_scheme, data_product_type.
 */
export function getFieldDatasetSchema() {
  return createSchemaView("FieldDataset", "FieldDatasetSchema");
}

/**
 * Gets the ModelOutputDataset schema for model output datasets.
 * Has if/then conditional (simulation_type → mcdr_forcing_description)
 * so needs additionalProperties: true.
 */
export function getModelOutputDatasetSchema() {
  return createSchemaView("ModelOutputDataset", "ModelOutputDatasetSchema", true);
}
