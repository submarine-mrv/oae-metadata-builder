/**
 * Which CF standard names a variable type may use, and what selecting one prefills.
 *
 * Four quantities (pH, TA, DIC, CO₂) are restricted to a curated shortlist; every
 * other variable type gets the full CF list. Curation lives in
 * src/data/cf/cfShortlists.json so the build script can validate it against the
 * current CF table.
 */

import shortlistConfig from "@/data/cf/cfShortlists.json";
import { CF_SHORTLIST_ENTRIES, type CfEntry } from "@/data/cf/cfStandardNames";

const SHORTLISTS = shortlistConfig.shortlists as Record<string, string[]>;
const MODEL_SHORTLISTS = shortlistConfig.modelShortlists as Record<string, string[]>;
const MODEL_TYPE_ALIASES = shortlistConfig.modelTypeAliases as Record<string, string>;
const LONG_NAME_FOR = shortlistConfig.longNameFor as Record<string, string>;
const CONCENTRATION_BASIS = shortlistConfig.concentrationBasis as Record<string, string>;
const UNIT_SUGGESTIONS = shortlistConfig.unitSuggestions as Record<string, string[]>;

const ENTRY_BY_NAME = new Map(CF_SHORTLIST_ENTRIES.map((e) => [e.name, e]));

/**
 * The curated CF entries for a variable type, or null when the type has no
 * shortlist and should use the full searchable list.
 *
 * Model output uses ModelVariableType. Four of its values name the same quantity as
 * a field type and reuse that shortlist through modelTypeAliases; the rest are
 * model-only (fluxes, physical state) and have their own lists.
 */
export function getShortlistFor(
  variableType: string | null | undefined,
  isModelOutput = false,
): CfEntry[] | null {
  if (!variableType) return null;

  let names: string[] | undefined;
  if (isModelOutput) {
    const aliased = MODEL_TYPE_ALIASES[variableType];
    names = MODEL_SHORTLISTS[variableType] ?? (aliased ? SHORTLISTS[aliased] : undefined);
  } else {
    names = SHORTLISTS[variableType];
  }
  if (!names) return null;

  return names.map((n) => ENTRY_BY_NAME.get(n)).filter((e): e is CfEntry => !!e);
}

/** Curated human-readable long_name for a CF name, e.g. "pCO2". */
export function getLongNameFor(cfName: string): string | undefined {
  return LONG_NAME_FOR[cfName];
}

/**
 * The concentration_basis a CF name implies. TA and DIC each have a per-volume and
 * a per-mass name, and concentration_basis is required on both, so picking the name
 * has to set it or the two can disagree.
 */
export function getConcentrationBasisFor(cfName: string): string | undefined {
  return CONCENTRATION_BASIS[cfName];
}

/**
 * Unit strings to offer for a CF name. Any other unit can still be typed.
 *
 * Curation replaces the CF canonical unit rather than extending it: pH is reported
 * on a named scale, not as CF's dimensionless `1`, and salinity as PSU rather than
 * `1e-3`. Names with no curation fall back to their canonical unit.
 */
export function getUnitSuggestions(entry: CfEntry | null | undefined): string[] {
  if (!entry) return [];
  const curated = UNIT_SUGGESTIONS[entry.name];
  return [...new Set((curated ?? [entry.units]).filter(Boolean))];
}

/** Fallback long_name when a CF name has no curated label. */
export function humanizeCfName(cfName: string): string {
  return cfName.replace(/_/g, " ");
}
