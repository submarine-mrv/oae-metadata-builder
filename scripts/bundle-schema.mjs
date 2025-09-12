// scripts/bundle-schema.mjs
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { readFile, writeFile } from "node:fs/promises";

const INPUT = "./schemas/schema.json"; // LinkML output
const OUTPUT = "./public/schema.bundled.json";
const LABELS = "./schemas/sea_names_labeled.json";

const base = await $RefParser.bundle(INPUT, {
  dereference: { circular: "ignore" }
});
const labels = JSON.parse(await readFile(LABELS, "utf-8"));

function decorateSeaNames(schema, labels) {
  const sea = schema?.properties?.sea_names;
  if (!sea) return schema;
  const oneOf = labels
    .filter((x, i, arr) => arr.findIndex((y) => y.uri === x.uri) === i)
    .sort((a, b) => a.prefLabel.localeCompare(b.prefLabel))
    .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));
  return {
    ...schema,
    properties: {
      ...schema.properties,
      sea_names: {
        ...sea,
        uniqueItems: true,
        items: { oneOf }
      }
    }
  };
}

function decorateMCDRPathways(schema) {
  // Just return the schema unchanged for now
  return schema;
}

let decorated = decorateSeaNames(base, labels);
decorated = decorateMCDRPathways(decorated);
await writeFile(OUTPUT, JSON.stringify(decorated, null, 2));
console.log(
  "✅ schema with labeled sea_names and MCDR pathways written to",
  OUTPUT
);
