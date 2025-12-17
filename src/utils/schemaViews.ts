/**
 * Schema view utilities for creating RJSF schemas from the base Container schema.
 *
 * The base schema has Container as the root, but our forms need specific views
 * (Project, Experiment, Intervention, etc.). These utilities extract the relevant
 * schema definition and preserve metadata like protocol version and git hash.
 */

import baseSchema from "@/../public/schema.bundled.json";
import type { RJSFSchema } from "@rjsf/utils";

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
    gitHash: baseSchema["x-protocol-git-hash"] || ""
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
function createSchemaView(defName: string, schemaId: string, hasConditionalFields = false): RJSFSchema {
  const def = (baseSchema as any).$defs?.[defName];

  if (!def) {
    throw new Error(`${defName} definition not found in schema`);
  }

  // Cast to unknown first, then to RJSFSchema - needed because the JSON import
  // has very specific types that are structurally incompatible with JSONSchema7
  return {
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
    allOf: def.allOf
  } as unknown as RJSFSchema;
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
  return createSchemaView(
    "InterventionWithTracer",
    "InterventionWithTracerSchema",
    true
  );
}
