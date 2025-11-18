/**
 * Schema view utilities for creating RJSF schemas from the base Container schema.
 *
 * The base schema has Container as the root, but our forms need specific views
 * (Project, Experiment, Intervention, etc.). These utilities extract the relevant
 * schema definition and preserve metadata like protocol version and git hash.
 */

import baseSchema from "@/../public/schema.bundled.json";
import type { RJSFSchema } from "@rjsf/utils";

export interface ProtocolMetadata {
  version: string;
  gitHash: string;
}

/**
 * Gets the base Container schema with all definitions and metadata
 */
export function getBaseSchema(): RJSFSchema {
  return baseSchema as RJSFSchema;
}

/**
 * Gets protocol version metadata from the schema
 */
export function getProtocolMetadata(): ProtocolMetadata {
  return {
    version: (baseSchema as Record<string, string>)["x-protocol-version"] || "",
    gitHash: (baseSchema as Record<string, string>)["x-protocol-git-hash"] || ""
  };
}

/**
 * Creates a schema view by extracting a definition from $defs and
 * making it the root schema while preserving all $defs and metadata
 */
function createSchemaView(defName: string, schemaId: string): RJSFSchema {
  const def = (baseSchema as any).$defs?.[defName];

  if (!def) {
    throw new Error(`${defName} definition not found in schema`);
  }

  return {
    ...baseSchema,
    $id: schemaId,
    title: def.title,
    description: def.description,
    properties: def.properties,
    required: def.required,
    additionalProperties: def.additionalProperties
  } as RJSFSchema;
}

/**
 * Gets the Project schema for the project form
 */
export function getProjectSchema(): RJSFSchema {
  return createSchemaView("Project", "ProjectSchema");
}

/**
 * Gets the Experiment schema for the experiment form
 */
export function getExperimentSchema(): RJSFSchema {
  return createSchemaView("Experiment", "ExperimentSchema");
}

/**
 * Gets the Intervention schema for intervention-type experiments
 */
export function getInterventionSchema(): RJSFSchema {
  return createSchemaView("Intervention", "InterventionSchema");
}

/**
 * Gets the Tracer schema for tracer-type experiments
 */
export function getTracerSchema(): RJSFSchema {
  return createSchemaView("Tracer", "TracerSchema");
}

/**
 * Gets the InterventionWithTracer schema
 */
export function getInterventionWithTracerSchema(): RJSFSchema {
  return createSchemaView("InterventionWithTracer", "InterventionWithTracerSchema");
}
