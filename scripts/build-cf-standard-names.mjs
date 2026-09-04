// scripts/build-cf-standard-names.mjs
//
// Joins the NERC NVS P07 collection (which assigns each CF standard name a stable
// URI) against the CF standard name table (which carries canonical units and
// aliases), and emits the two data files the variable form reads.
//
// Inputs are fetched by `make cf-vocab` into schemas/cf/.
// Outputs are committed — CI runs `npm run build`, never `make`.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const P07_FILE = "./schemas/cf/p07.json";
const CF_TABLE_FILE = "./schemas/cf/cf-standard-name-table.xml";
const SHORTLIST_FILE = "./src/data/cf/cfShortlists.json";

const OUT_DIR = "./src/data/cf";
const INDEX_OUT = `${OUT_DIR}/cfStandardNames.index.json`;
const SHORTLIST_OUT = `${OUT_DIR}/cfShortlistEntries.json`;

const XML_ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

function decodeXml(s) {
  return s.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]);
}

/**
 * The CF table is a flat, stable list of <entry>/<alias> elements. A targeted scan
 * avoids pulling in an XML parser for a format that has not changed shape in years;
 * the assertions below are what actually guard the result.
 */
function parseCfTable(xml) {
  const version = /<version_number>\s*([^<]+?)\s*<\/version_number>/.exec(xml)?.[1] ?? "unknown";
  const lastModified = /<last_modified>\s*([^<]+?)\s*<\/last_modified>/.exec(xml)?.[1] ?? "unknown";

  const entries = new Map();
  const entryRe = /<entry\s+id="([^"]+)"\s*>([\s\S]*?)<\/entry>/g;
  for (const [, id, body] of xml.matchAll(entryRe)) {
    const units = /<canonical_units>([\s\S]*?)<\/canonical_units>/.exec(body)?.[1] ?? "";
    entries.set(decodeXml(id), decodeXml(units).trim());
  }

  const aliases = [];
  const aliasRe = /<alias\s+id="([^"]+)"\s*>([\s\S]*?)<\/alias>/g;
  for (const [, id, body] of xml.matchAll(aliasRe)) {
    const target = /<entry_id>([\s\S]*?)<\/entry_id>/.exec(body)?.[1];
    if (target) aliases.push([decodeXml(id), decodeXml(target).trim()]);
  }

  return { version, lastModified, entries, aliases };
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const [p07Raw, cfRaw, shortlistRaw] = await Promise.all([
  readFile(P07_FILE, "utf-8").catch(() => fail(`Missing ${P07_FILE} — run 'make cf-vocab'`)),
  readFile(CF_TABLE_FILE, "utf-8").catch(() => fail(`Missing ${CF_TABLE_FILE} — run 'make cf-vocab'`)),
  readFile(SHORTLIST_FILE, "utf-8"),
]);

const p07 = JSON.parse(p07Raw);
if (!Array.isArray(p07) || p07.length === 0) fail(`${P07_FILE} is not a non-empty array`);

const cf = parseCfTable(cfRaw);
const shortlists = JSON.parse(shortlistRaw);

// All P07 URIs share one prefix; store it once in meta and keep only the id per row.
const uriBase = "http://vocab.nerc.ac.uk/collection/P07/current/";
const strayPrefix = p07.find((c) => typeof c.uri !== "string" || !c.uri.startsWith(uriBase));
if (strayPrefix) fail(`P07 URI outside expected prefix: ${strayPrefix.uri}`);

const p07ById = new Map();
for (const concept of p07) {
  if (typeof concept.prefLabel !== "string" || !concept.prefLabel) continue;
  p07ById.set(concept.prefLabel, concept.uri.slice(uriBase.length).replace(/\/$/, ""));
}

// Inner join, and that is also the filter for "current and accepted": the P07 rows
// that fail to join are the deprecated concepts, which the CF table has already
// dropped. Widening this to a left join would resurrect ~600 deprecated names.
const entries = [];
for (const [name, units] of cf.entries) {
  const id = p07ById.get(name);
  if (id) entries.push([name, id, units]);
}
entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const joinedNames = new Set(entries.map((e) => e[0]));
const aliases = cf.aliases.filter(([, target]) => joinedNames.has(target)).sort((a, b) => (a[0] < b[0] ? -1 : 1));

if (entries.length < 5000) fail(`Only ${entries.length} names joined; expected at least 5000`);
const joinRate = entries.length / cf.entries.size;
if (joinRate < 0.99) {
  fail(`Join rate ${(joinRate * 100).toFixed(1)}% of the CF table; expected at least 99%`);
}

const unitsByName = new Map(entries.map(([name, , units]) => [name, units]));
const shortlistEntries = [];
const seenShortlist = new Set();
// Field and model shortlists resolve into one flat entry list — the UI looks names
// up by name, and the two never disagree about a name's URI or units.
for (const group of ["shortlists", "modelShortlists"]) {
  for (const [variableType, names] of Object.entries(shortlists[group] ?? {})) {
    for (const name of names) {
      if (!unitsByName.has(name)) {
        fail(`${group}.${variableType} names one that is not in CF table v${cf.version}: ${name}`);
      }
      if (seenShortlist.has(name)) continue;
      seenShortlist.add(name);
      shortlistEntries.push({
        name,
        uri: `${uriBase}${p07ById.get(name)}/`,
        units: unitsByName.get(name),
      });
    }
  }
}
shortlistEntries.sort((a, b) => (a.name < b.name ? -1 : 1));

// Every name carrying auxiliary curation must be a real CF name, or the curation
// silently never applies.
for (const key of ["longNameFor", "concentrationBasis", "unitSuggestions"]) {
  for (const name of Object.keys(shortlists[key] ?? {})) {
    if (!unitsByName.has(name)) fail(`${key} references unknown CF name: ${name}`);
  }
}

// Aliases map a model variable type onto a field shortlist; a typo would silently
// drop that type back to the full search.
for (const [modelType, fieldType] of Object.entries(shortlists.modelTypeAliases ?? {})) {
  if (!shortlists.shortlists[fieldType]) {
    fail(`modelTypeAliases.${modelType} points at unknown shortlist: ${fieldType}`);
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  INDEX_OUT,
  `${JSON.stringify({
    meta: {
      cfTableVersion: cf.version,
      cfTableLastModified: cf.lastModified,
      uriBase,
      entryCount: entries.length,
    },
    entries,
    aliases,
  })}\n`,
);
await writeFile(SHORTLIST_OUT, `${JSON.stringify(shortlistEntries, null, 2)}\n`);

console.log(`✓ CF standard name table v${cf.version} (${cf.lastModified})`);
console.log(`✓ ${entries.length} names joined against P07 (${(joinRate * 100).toFixed(1)}% of table), ${aliases.length} aliases`);
console.log(`✓ ${shortlistEntries.length} curated shortlist entries`);
console.log(`✓ Wrote ${INDEX_OUT} and ${SHORTLIST_OUT}`);
