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

function fixConditionalFields(schema) {
  // Remove conditional "_custom" fields from root properties in any class that has them
  // This fixes LinkML-generated schemas where conditional fields appear in both
  // root properties AND the then block, causing them to always be visible
  //
  // IMPORTANT: All schemas which have conditional fields MUST have
  // additionalProperties set to false

  const conditionalFields = [
    "feedstock_type_custom",
    "alkalinity_feedstock_custom",
    "alkalinity_feedstock_processing_custom"
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
