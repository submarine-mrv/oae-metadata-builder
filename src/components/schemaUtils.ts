/**
 * Utility functions for working with JSON Schema in the Variable Modal
 *
 * These utilities help:
 * - Resolve $ref references in schemas
 * - Check if a field path exists in a schema
 * - Get field metadata (title, description, type, required)
 * - Handle nested paths like "analyzing_instrument.calibration.dye_purified"
 */

import { formatEnumTitle } from "@/utils/enumDecorator";

// Type definitions for JSON Schema
export interface JSONSchema {
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  enum?: (string | number | boolean)[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  items?: JSONSchema;
  format?: string;
  pattern?: string;
  default?: unknown;
  const?: unknown;
}

export interface FieldMetadata {
  title: string;
  description?: string;
  type: string;
  required: boolean;
  enum?: (string | number | boolean)[];
  format?: string;
  schema: JSONSchema;
}

/**
 * Resolves a $ref in a schema to its actual definition.
 * Handles references like "#/$defs/PHInstrument"
 */
export function resolveRef(
  schema: JSONSchema,
  rootSchema: JSONSchema
): JSONSchema {
  if (!schema.$ref) {
    return schema;
  }

  // Parse the $ref path (e.g., "#/$defs/PHInstrument")
  const refPath = schema.$ref;
  if (!refPath.startsWith("#/")) {
    console.warn(`Unsupported $ref format: ${refPath}`);
    return schema;
  }

  const pathParts = refPath.slice(2).split("/");
  let resolved: JSONSchema | undefined = rootSchema;

  for (const part of pathParts) {
    if (resolved && typeof resolved === "object") {
      resolved = (resolved as Record<string, JSONSchema>)[part];
    } else {
      console.warn(`Could not resolve $ref path: ${refPath}`);
      return schema;
    }
  }

  if (!resolved) {
    console.warn(`$ref resolved to undefined: ${refPath}`);
    return schema;
  }

  // Recursively resolve if the result also has a $ref
  return resolveRef(resolved, rootSchema);
}

/**
 * Gets the schema for a nested field path.
 * Handles paths like "analyzing_instrument.calibration.dye_purified"
 *
 * @param fieldPath - Dot-separated path to the field
 * @param variableSchema - The variable schema (e.g., DiscretePHVariable)
 * @param rootSchema - The root schema containing $defs
 * @returns The field schema or null if not found
 */
export function getFieldSchema(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema
): JSONSchema | null {
  const parts = fieldPath.split(".");
  let currentSchema = variableSchema;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Resolve any $ref at current level
    currentSchema = resolveRef(currentSchema, rootSchema);

    // Handle allOf - merge all branches' properties before checking for the field
    if (currentSchema.allOf) {
      const merged: JSONSchema = { ...currentSchema, properties: { ...currentSchema.properties } };
      for (const branch of currentSchema.allOf) {
        const resolved = resolveRef(branch, rootSchema);
        if (resolved.properties) {
          merged.properties = { ...merged.properties, ...resolved.properties };
        }
        if (resolved.required) {
          merged.required = [...(merged.required || []), ...resolved.required];
        }
      }
      if (merged.required) {
        merged.required = [...new Set(merged.required)];
      }
      currentSchema = merged;
    }

    // Handle anyOf/oneOf - try to find a schema that has this property
    if (currentSchema.anyOf || currentSchema.oneOf) {
      const options = currentSchema.anyOf || currentSchema.oneOf || [];
      let found = false;
      for (const option of options) {
        const resolved = resolveRef(option, rootSchema);
        if (resolved.properties?.[part]) {
          currentSchema = resolved;
          found = true;
          break;
        }
      }
      if (!found) {
        return null;
      }
    }

    // Get the property
    const properties = currentSchema.properties;
    if (!properties || !properties[part]) {
      return null;
    }

    currentSchema = properties[part];
  }

  // Return without resolving - let caller decide whether to resolve
  // This preserves property-level metadata (title, description) for $ref fields
  return currentSchema;
}

/**
 * Checks if a field path exists in the given schema.
 */
export function fieldExistsInSchema(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema
): boolean {
  return getFieldSchema(fieldPath, variableSchema, rootSchema) !== null;
}

/**
 * Checks if a field is required at its nesting level.
 * For "analyzing_instrument.calibration.dye_purified":
 * - Checks if "dye_purified" is in PHCalibration.required
 *
 * Note: This doesn't check if parent objects are required.
 */
/**
 * Resolves a schema and merges allOf required arrays.
 * Used by isFieldRequired to correctly detect conditionally-required fields.
 */
function resolveWithAllOf(
  schema: JSONSchema,
  rootSchema: JSONSchema
): JSONSchema {
  const resolved = resolveRef(schema, rootSchema);
  if (!resolved.allOf) return resolved;

  const merged: JSONSchema = { ...resolved };
  let required = [...(merged.required || [])];
  for (const branch of resolved.allOf) {
    const resolvedBranch = resolveRef(branch, rootSchema);
    if (resolvedBranch.required) {
      required = [...required, ...resolvedBranch.required];
    }
  }
  if (required.length > 0) {
    merged.required = [...new Set(required)];
  }
  return merged;
}

export function isFieldRequired(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema
): boolean {
  const parts = fieldPath.split(".");
  const fieldName = parts[parts.length - 1];

  // If it's a top-level field, check variableSchema.required (with allOf merge)
  if (parts.length === 1) {
    const resolved = resolveWithAllOf(variableSchema, rootSchema);
    return resolved.required?.includes(fieldName) ?? false;
  }

  // For nested fields, we need to get the parent schema and check its required array
  const parentPath = parts.slice(0, -1).join(".");
  const parentSchema = getFieldSchema(parentPath, variableSchema, rootSchema);

  if (!parentSchema) {
    return false;
  }

  const resolvedParent = resolveWithAllOf(parentSchema, rootSchema);
  return resolvedParent.required?.includes(fieldName) ?? false;
}

/**
 * Gets complete metadata for a field, ready to render.
 */
export function getFieldMetadata(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema
): FieldMetadata | null {
  const fieldSchema = getFieldSchema(fieldPath, variableSchema, rootSchema);
  if (!fieldSchema) {
    return null;
  }

  // Preserve property-level title/description before resolving $ref
  // (LinkML puts slot-level metadata at the property, not the referenced class)
  const propertyTitle = fieldSchema.title;
  const propertyDescription = fieldSchema.description;

  const resolved = resolveRef(fieldSchema, rootSchema);

  // Determine the type
  let type = "string";
  if (resolved.type) {
    type = Array.isArray(resolved.type) ? resolved.type[0] : resolved.type;
  } else if (resolved.enum) {
    type = "enum";
  } else if (resolved.anyOf || resolved.oneOf) {
    type = "union";
  }

  return {
    // Prefer property-level title/description over resolved $ref's
    title: propertyTitle || resolved.title || fieldPath.split(".").pop() || fieldPath,
    description: propertyDescription || resolved.description,
    type,
    required: isFieldRequired(fieldPath, variableSchema, rootSchema),
    enum: resolved.enum,
    format: resolved.format,
    schema: resolved,
  };
}

/**
 * Gets a nested value from form data using a dot-separated path.
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Sets a nested value in form data using a dot-separated path.
 * Returns a new object with the updated value (immutable).
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split(".");
  const result = { ...obj };

  if (parts.length === 1) {
    result[parts[0]] = value;
    return result;
  }

  // Build nested structure
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      !current[part] ||
      typeof current[part] !== "object" ||
      Array.isArray(current[part])
    ) {
      current[part] = {};
    } else {
      current[part] = { ...(current[part] as Record<string, unknown>) };
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

/**
 * Gets enum options from a schema, resolving $refs if needed.
 * Returns array of { value, label } objects.
 * Uses formatEnumTitle from enumDecorator for consistent formatting with override support.
 */
export function getEnumOptions(
  fieldSchema: JSONSchema,
  rootSchema: JSONSchema
): { value: string; label: string }[] {
  const resolved = resolveRef(fieldSchema, rootSchema);

  if (resolved.enum) {
    return resolved.enum.map((value) => ({
      value: String(value),
      label: formatEnumTitle(String(value)),
    }));
  }

  return [];
}
