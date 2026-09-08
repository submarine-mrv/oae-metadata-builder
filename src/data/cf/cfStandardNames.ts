/**
 * CF Standard Name vocabulary, joined against NERC NVS P07 at build time by
 * scripts/build-cf-standard-names.mjs. See docs/cf-standard-names.md.
 *
 * This module is the only place cfStandardNames.index.json may be imported. It is
 * ~73 KB gzipped, so it loads through a dynamic import and stays out of the initial
 * bundle; a static import anywhere else would undo that.
 */

import shortlistEntries from "./cfShortlistEntries.json";

export interface CfEntry {
  /** The CF standard name, e.g. "sea_water_ph_reported_on_total_scale" */
  name: string;
  /** Canonical NVS P07 URI */
  uri: string;
  /** CF canonical units, e.g. "mol kg-1". "1" means dimensionless. */
  units: string;
}

export interface CfAlias {
  alias: string;
  /** The current CF name this alias resolves to */
  target: string;
}

export interface CfIndex {
  entries: CfEntry[];
  aliases: CfAlias[];
  byName: Map<string, CfEntry>;
  cfTableVersion: string;
}

interface RawIndex {
  meta: { cfTableVersion: string; uriBase: string; entryCount: number };
  entries: [name: string, p07Id: string, units: string][];
  aliases: [alias: string, target: string][];
}

/** Curated entries for pH/TA/DIC/CO₂, eager because they are ~2 KB. */
export const CF_SHORTLIST_ENTRIES: CfEntry[] = shortlistEntries;

let indexPromise: Promise<CfIndex> | null = null;

/** Loads and caches the full 5,000-name index. Safe to call on every render. */
export function loadCfIndex(): Promise<CfIndex> {
  if (!indexPromise) {
    indexPromise = import("./cfStandardNames.index.json").then((mod) => {
      const raw = (mod.default ?? mod) as unknown as RawIndex;
      const entries = raw.entries.map(([name, id, units]) => ({
        name,
        uri: `${raw.meta.uriBase}${id}/`,
        units,
      }));
      return {
        entries,
        aliases: raw.aliases.map(([alias, target]) => ({ alias, target })),
        byName: new Map(entries.map((e) => [e.name, e])),
        cfTableVersion: raw.meta.cfTableVersion,
      };
    });
    // A rejected promise must not stay cached, or no retry could ever succeed.
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
}

/** The VocabularyItemReference written to standard_identifier. */
export function toVocabularyItemReference(entry: CfEntry): { term: string; uri: string } {
  return { term: entry.name, uri: entry.uri };
}
