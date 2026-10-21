/**
 * Utility functions for working with JSON Schema in the Variable Modal
 *
 * These utilities help:
 * - Resolve $ref references in schemas
 * - Check if a field path exists in a schema
 * - Get field metadata (title, description, type, required)
 * - Handle nested paths like "analyzing_instrument.calibration.dye_purified"
 */

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
  discriminator?: { propertyName: string };
}

/** The rule keywords isFieldRequired reads; kept off JSONSchema so JSON imports still cast to it. */
type RuleSchema = JSONSchema & { if?: RuleSchema; then?: RuleSchema; contains?: RuleSchema };

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
export function resolveRef(schema: JSONSchema, rootSchema: JSONSchema): JSONSchema {
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
  rootSchema: JSONSchema,
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
      // A discriminator splits its values across branches; offer all of them.
      if (currentSchema.discriminator?.propertyName === part && i === parts.length - 1) {
        return mergeDiscriminatorOptions(options, part, rootSchema);
      }
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
    if (!properties?.[part]) {
      return null;
    }

    currentSchema = properties[part];
  }

  // Return without resolving - let caller decide whether to resolve
  // This preserves property-level metadata (title, description) for $ref fields
  return currentSchema;
}

/** The discriminator property with every branch's values combined into one enum. */
function mergeDiscriminatorOptions(
  options: JSONSchema[],
  part: string,
  rootSchema: JSONSchema,
): JSONSchema | null {
  const props = options
    .map((option) => resolveRef(option, rootSchema).properties?.[part])
    .filter((prop): prop is JSONSchema => !!prop);
  if (props.length === 0) return null;
  const values = props.flatMap(
    (prop) => prop.enum ?? (prop.const !== undefined ? [prop.const] : []),
  );
  const { const: _const, ...first } = props[0];
  return { ...first, enum: [...new Set(values)] as (string | number | boolean)[] };
}

/**
 * Checks if a field path exists in the given schema.
 */
export function fieldExistsInSchema(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema,
): boolean {
  return getFieldSchema(fieldPath, variableSchema, rootSchema) !== null;
}

/**
 * Resolves a schema and merges allOf required arrays.
 * Used by isFieldRequired to correctly detect conditionally-required fields.
 */
function resolveWithAllOf(schema: JSONSchema, rootSchema: JSONSchema): JSONSchema {
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

/** Whether a value satisfies the `const`/`enum`/`contains` checks the schema's rules use. */
function matchesValue(condition: RuleSchema, value: unknown): boolean {
  if (condition.const !== undefined && value !== condition.const) return false;
  if (condition.enum && !condition.enum.includes(value as string | number | boolean)) return false;
  if (condition.contains) {
    const contains = condition.contains;
    if (!Array.isArray(value) || !value.some((item) => matchesValue(contains, item))) return false;
  }
  return true;
}

/** Evaluates an `if` against form data. A missing property never matches. */
function matchesIf(condition: RuleSchema, data: Record<string, unknown>): boolean {
  const props = condition.properties ?? {};
  for (const key of new Set([...(condition.required ?? []), ...Object.keys(props)])) {
    if (!hasValue(data[key])) return false;
    if (props[key] && !matchesValue(props[key], data[key])) return false;
  }
  return true;
}

/** Fields an `if/then` rule (at the root or inside allOf) requires for this data. */
function requiredByRules(
  schema: JSONSchema,
  data: Record<string, unknown>,
  rootSchema: JSONSchema,
): string[] {
  const rules: RuleSchema[] = [
    schema,
    ...(schema.allOf ?? []).map((branch) => resolveRef(branch, rootSchema)),
  ];
  return rules.flatMap((rule) =>
    rule.if && rule.then?.required && matchesIf(rule.if, data) ? rule.then.required : [],
  );
}

/** The union branch a discriminated parent selects for this data, if any. */
function selectedBranch(
  parent: JSONSchema,
  options: JSONSchema[],
  data: Record<string, unknown> | undefined,
  rootSchema: JSONSchema,
): JSONSchema | undefined {
  const tag = parent.discriminator?.propertyName;
  if (!tag || !data || !hasValue(data[tag])) return undefined;
  return options
    .map((option) => resolveWithAllOf(option, rootSchema))
    .find((branch) => {
      const prop = branch.properties?.[tag];
      return prop !== undefined && matchesValue(prop, data[tag]);
    });
}

/** Whether `fieldName` is required by a parent schema, which may be a union. */
function requiredByParent(
  parent: JSONSchema,
  fieldName: string,
  rootSchema: JSONSchema,
  data?: Record<string, unknown>,
): boolean {
  const resolved = resolveWithAllOf(parent, rootSchema);
  const options = resolved.anyOf || resolved.oneOf;
  const schema = options ? selectedBranch(resolved, options, data, rootSchema) : resolved;
  if (schema) {
    if (schema.required?.includes(fieldName)) return true;
    return data ? requiredByRules(schema, data, rootSchema).includes(fieldName) : false;
  }
  // No branch selected: required only if every branch that defines the field requires it.
  const branches = (options ?? [])
    .map((option) => resolveWithAllOf(option, rootSchema))
    .filter((branch) => branch.properties?.[fieldName]);
  return branches.length > 0 && branches.every((b) => b.required?.includes(fieldName));
}

/** Required by its immediate parent, ignoring whether the parent is required. */
function isRequiredAtLevel(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema,
  formData?: Record<string, unknown>,
): boolean {
  const parts = fieldPath.split(".");
  const fieldName = parts[parts.length - 1];
  const parentPath = parts.slice(0, -1).join(".");
  const parent =
    parts.length === 1 ? variableSchema : getFieldSchema(parentPath, variableSchema, rootSchema);
  if (!parent) return false;
  const parentData = parts.length === 1 ? formData : getNestedValue(formData ?? {}, parentPath);
  const isObject = parentData && typeof parentData === "object" && !Array.isArray(parentData);
  const data = isObject ? (parentData as Record<string, unknown>) : formData ? {} : undefined;
  return requiredByParent(parent, fieldName, rootSchema, data);
}

/** Whether a value counts as filled in: empty strings, arrays and objects don't. */
export function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === "object") return Object.values(value).some(hasValue);
  return true;
}

/**
 * Checks if a field is required. With `formData`, a field under an optional
 * object (e.g. a generic variable's calibration) counts as required only once
 * that object has data, matching how JSON Schema applies `required`. Form data
 * also selects the discriminated union branch and applies `if/then` rules.
 */
export function isFieldRequired(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema,
  formData?: Record<string, unknown>,
): boolean {
  if (!isRequiredAtLevel(fieldPath, variableSchema, rootSchema, formData)) return false;
  if (!formData) return true;
  const parts = fieldPath.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ancestor = parts.slice(0, i).join(".");
    if (isRequiredAtLevel(ancestor, variableSchema, rootSchema, formData)) continue;
    if (!hasValue(getNestedValue(formData, ancestor))) return false;
  }
  return true;
}

/**
 * Gets complete metadata for a field, ready to render.
 */
export function getFieldMetadata(
  fieldPath: string,
  variableSchema: JSONSchema,
  rootSchema: JSONSchema,
  formData?: Record<string, unknown>,
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
    required: isFieldRequired(fieldPath, variableSchema, rootSchema, formData),
    enum: resolved.enum,
    format: resolved.format,
    schema: resolved,
  };
}

/**
 * Gets a nested value from form data using a dot-separated path.
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
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
  value: unknown,
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
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
      current[part] = {};
    } else {
      current[part] = { ...(current[part] as Record<string, unknown>) };
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}
