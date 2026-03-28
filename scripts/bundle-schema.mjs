// scripts/bundle-schema.mjs
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { readFile, writeFile } from "node:fs/promises";

const INPUT = "./schemas/schema.json"; // LinkML output
const OUTPUT = "./public/schema.bundled.json";

// NVS vocabulary files (fetched via `make nvs-vocabs`)
const NVS_DIR = "./schemas/nvs";
const SEA_NAMES_FILE = `${NVS_DIR}/sea_names.json`;
const PLATFORM_TYPES_FILE = `${NVS_DIR}/platform_types.json`;

// Get protocol git hash from command line argument
const protocolGitHash = process.argv[3];

if (!protocolGitHash) {
  console.error("❌ Error: Protocol git hash not provided");
  console.error("   Usage: node bundle-schema.mjs <schema-path> <git-hash>");
  process.exit(1);
}

// Validate git hash format (SHA-1 is 40 hex characters)
if (!/^[0-9a-f]{40}$/i.test(protocolGitHash)) {
  console.error(`❌ Error: Invalid git hash format: ${protocolGitHash}`);
  console.error("   Expected 40-character SHA-1 hash");
  process.exit(1);
}

const base = await $RefParser.bundle(INPUT, {
  dereference: { circular: "ignore" }
});

// Load NVS vocabulary labels
const seaNameLabels = JSON.parse(await readFile(SEA_NAMES_FILE, "utf-8"));
const platformTypeLabels = JSON.parse(await readFile(PLATFORM_TYPES_FILE, "utf-8"));

/**
 * Converts NVS labels array to oneOf format for JSON Schema
 * @param {Array} labels - Array of { uri, prefLabel } from NVS
 * @param {Array} [allowedUris] - Optional list of URIs to filter by (from schema enum)
 * @returns {Array} oneOf array with { const, title }
 */
function labelsToOneOf(labels, allowedUris = null) {
  // Build lookup map from labels
  const labelMap = new Map(
    labels
      .filter((x) => x && x.uri && x.prefLabel)
      .map(({ uri, prefLabel }) => [uri, prefLabel])
  );

  // If allowedUris provided, use those and look up labels
  // Otherwise use all labels
  const entries = allowedUris
    ? allowedUris.map((uri) => ({
        const: uri,
        title: labelMap.get(uri) || uri.split("/").pop() // fallback to last URI segment
      }))
    : Array.from(labelMap.entries()).map(([uri, prefLabel]) => ({
        const: uri,
        title: prefLabel
      }));

  // Dedupe by URI and sort by label
  return entries
    .filter((x, i, arr) => arr.findIndex((y) => y.const === x.const) === i)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Decorates a schema definition with NVS labels
 * Supports two patterns:
 * - "enum": Replaces enum with oneOf (for $defs like PlatformType)
 * - "array": Sets items.oneOf for array fields (for fields like sea_names)
 *
 * @param {Object} schema - The full schema
 * @param {Object} config - Decoration config
 * @param {string} config.name - Human-readable name for logging
 * @param {Array} config.labels - NVS labels array
 * @param {string} config.defName - Name of the $def to modify (e.g., "PlatformType")
 * @param {string} [config.fieldPath] - Dot-separated path to field within $def (e.g., "properties.sea_names")
 * @param {"enum"|"array"} config.type - How to apply the decoration
 * @returns {Object} Modified schema
 */
function decorateWithNvsLabels(schema, config) {
  const { name, labels, defName, fieldPath, type } = config;

  // Navigate to the target definition
  let target = schema.$defs?.[defName];
  if (fieldPath) {
    for (const key of fieldPath.split(".")) {
      target = target?.[key];
    }
  }

  if (!target) {
    console.warn(`⚠️  ${name}: target not found at $defs.${defName}${fieldPath ? "." + fieldPath : ""}`);
    return schema;
  }

  // Get allowed URIs from existing enum if present
  const allowedUris = target.enum || target.items?.enum || null;
  const oneOf = labelsToOneOf(labels, allowedUris);

  if (oneOf.length === 0) {
    console.error(`❌ No valid labels found for ${name}`);
    throw new Error(`Invalid NVS data for ${name}`);
  }

  // Apply decoration based on type
  let updatedTarget;
  if (type === "enum") {
    // Replace enum with oneOf
    const { enum: _enum, ...rest } = target;
    updatedTarget = { ...rest, oneOf };
  } else if (type === "array") {
    // Set items.oneOf for array fields
    updatedTarget = { ...target, uniqueItems: true, items: { oneOf } };
  }

  console.log(`✓ Decorated ${name} with ${oneOf.length} labeled options`);

  // Rebuild schema with updated target
  if (fieldPath) {
    // Navigate and rebuild nested structure
    const pathParts = fieldPath.split(".");
    const rebuild = (obj, parts, value) => {
      if (parts.length === 0) return value;
      const [head, ...tail] = parts;
      return { ...obj, [head]: rebuild(obj[head], tail, value) };
    };
    return {
      ...schema,
      $defs: {
        ...schema.$defs,
        [defName]: rebuild(schema.$defs[defName], pathParts, updatedTarget)
      }
    };
  } else {
    return {
      ...schema,
      $defs: {
        ...schema.$defs,
        [defName]: updatedTarget
      }
    };
  }
}

// LinkML generates conditional fields (if/then rules) with the field in BOTH
// root `properties` (full definition) AND the `then` block (empty placeholder {}).
//
// Problem: RJSF renders anything in root `properties` unconditionally. The
// if/then only controls whether a field is *required*, not *visible*. So without
// this fix, conditional fields (e.g., alkalinity_feedstock_custom) would always
// show in the form — even when their trigger condition isn't met.
//
// Fix: Remove the field from root `properties` and copy the full definition
// into the `then` block. This way the field only appears when the condition
// matches.
//
// Note: The $defs here keep `additionalProperties: false` from LinkML, but at
// runtime schemaViews.ts overrides it to `true` for schemas with conditionals
// (RJSF requires that for if/then to render). That override creates a side
// effect — orphaned conditional data shows as key/value editors — which
// conditionalFields.ts cleans up via onChange.
//
// See: docs/conditional-fields.md for the full pipeline.
// See: src/utils/schemaViews.ts (additionalProperties override)
// See: src/utils/conditionalFields.ts (orphan cleanup)
function fixConditionalFields(schema) {

  const conditionalFields = [
    "feedstock_type_custom",
    "alkalinity_feedstock_custom",
    "alkalinity_feedstock_processing_custom",
    "mcdr_forcing_description",
    "model_component_type_custom",
    "tracer_form_custom"
  ];

  Object.keys(schema.$defs || {}).forEach((className) => {
    const classDef = schema.$defs[className];

    conditionalFields.forEach((fieldName) => {
      if (classDef.properties?.[fieldName]) {
        // Save the property definition
        const customDef = classDef.properties[fieldName];

        // Remove it from root properties
        delete classDef.properties[fieldName];

        // Update the then block if it exists at root level
        if (classDef.then?.properties?.[fieldName] !== undefined) {
          classDef.then.properties[fieldName] = customDef;
        }

        // Update the then block if it exists inside allOf array
        if (classDef.allOf && Array.isArray(classDef.allOf)) {
          classDef.allOf.forEach((condition) => {
            if (condition.then?.properties?.[fieldName] !== undefined) {
              condition.then.properties[fieldName] = customDef;
            }
          });
        }

        console.log(`✓ Fixed conditional field "${fieldName}" in ${className}`);
      }
    });
  });

  return schema;
}

/**
 * Converts snake_case enum values to Title Case labels.
 * Mirrors the frontend's formatEnumTitle() in src/utils/enumDecorator.ts
 */
const BUNDLER_ENUM_OVERRIDES = {
  air_sea_co2_flux: "Air-Sea CO₂ Flux",
  dissolved_inorganic_carbon: "Dissolved Inorganic Carbon (DIC)",
  total_alkalinity: "Total Alkalinity (TA)",
  ph: "pH",
  bgc_ecosystem: "BGC / Ecosystem"
};

function formatEnumTitle(value) {
  if (BUNDLER_ENUM_OVERRIDES[value]) return BUNDLER_ENUM_OVERRIDES[value];
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Resolves array fields where `items` references an enum via $ref, converting
// them into `items.oneOf` with human-readable labels.
//
// Why this is needed: For single-value enum properties, RJSF resolves the $ref
// and we provide labels via `ui:enumNames` in the uiSchema. But for multi-select
// arrays (type: "array" with enum items), `ui:enumNames` doesn't work — RJSF
// expects `items.oneOf` with `{ const, title }` pairs to render labeled options.
//
// This is the same structure that sea_names uses (produced by decorateWithNvsLabels),
// just with labels derived from snake_case formatting instead of NVS vocabularies.
//
// Without this, the multi-select would show raw enum values like "air_sea_co2_flux"
// instead of "Air-Sea CO₂ Flux".
function inlineEnumArrayItems(schema, configs) {
  for (const { defName, fieldPath } of configs) {
    const classDef = schema.$defs?.[defName];
    if (!classDef) continue;

    // Navigate to the field
    let target = classDef;
    for (const key of fieldPath.split(".")) {
      target = target?.[key];
    }

    if (!target || !target.items?.$ref) continue;

    // Resolve the $ref to get the enum def
    const refName = target.items.$ref.replace("#/$defs/", "");
    const enumDef = schema.$defs?.[refName];
    if (!enumDef?.enum) continue;

    // Build oneOf from enum values with formatted labels
    const oneOf = enumDef.enum.map((value) => ({
      const: value,
      title: formatEnumTitle(value)
    }));

    // Inline as oneOf with uniqueItems
    target.items = { oneOf };
    target.uniqueItems = true;

    console.log(`✓ Inlined ${refName} enum into ${defName}.${fieldPath.replace("properties.", "")} (${oneOf.length} options)`);
  }

  return schema;
}

// NVS decoration configurations
// Add new entries here when adding more NVS vocabularies
const nvsDecorations = [
  {
    name: "Sea Names",
    labels: seaNameLabels,
    defName: "Project",
    fieldPath: "properties.sea_names",
    type: "array"
  },
  {
    name: "Platform Types",
    labels: platformTypeLabels,
    defName: "PlatformType",
    type: "enum"
  }
];

// Apply all NVS decorations
let decorated = base;
for (const config of nvsDecorations) {
  decorated = decorateWithNvsLabels(decorated, config);
}

// Inline enum $ref array items as oneOf with labels for multi-select rendering
decorated = inlineEnumArrayItems(decorated, [
  {
    defName: "ModelOutputDataset",
    fieldPath: "properties.model_output_variables"
  }
]);

decorated = fixConditionalFields(decorated);

// Add x-protocol-git-hash field to root schema if git hash is provided
if (protocolGitHash) {
  decorated["x-protocol-git-hash"] = protocolGitHash;
  console.log(`✓ Added x-protocol-git-hash: ${protocolGitHash.substring(0, 8)}...`);
}

await writeFile(OUTPUT, JSON.stringify(decorated, null, 2));
console.log("✅ Bundled schema written to", OUTPUT);
console.log(`   - Protocol version: ${decorated["x-protocol-version"] || "unknown"}`);
console.log(`   - Protocol git hash: ${decorated["x-protocol-git-hash"]?.substring(0, 8) || "none"}...`);
console.log("\nSchema views (Project, Experiment, etc.) are created at runtime in src/utils/schemaViews.ts");
