// scripts/bundle-schema.mjs
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { readFile, writeFile } from "node:fs/promises";

const INPUT = "./schemas/schema.json"; // LinkML output
const OUTPUT = "./public/schema.bundled.json";
const LABELS = "./schemas/sea_names_labeled.json";

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
const labels = JSON.parse(await readFile(LABELS, "utf-8"));

function decorateSeaNames(schema, labels) {
  // sea_names is in Project definition in $defs, not at root
  const projectDef = schema.$defs?.Project;
  const sea = projectDef?.properties?.sea_names;

  if (!sea) {
    console.warn("⚠️  sea_names field not found in Project definition");
    return schema;
  }

  const oneOf = labels
    .filter((x) => x && x.uri && x.prefLabel) // Validate structure
    .filter((x, i, arr) => arr.findIndex((y) => y.uri === x.uri) === i)
    .sort((a, b) => a.prefLabel.localeCompare(b.prefLabel))
    .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

  if (oneOf.length === 0) {
    console.error("❌ No valid sea names found in labels file");
    throw new Error("Invalid sea names data - check schemas/sea_names_labeled.json");
  }

  return {
    ...schema,
    $defs: {
      ...schema.$defs,
      Project: {
        ...projectDef,
        properties: {
          ...projectDef.properties,
          sea_names: {
            ...sea,
            uniqueItems: true,
            items: { oneOf }
          }
        }
      }
    }
  };
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

let decorated = decorateSeaNames(base, labels);
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
