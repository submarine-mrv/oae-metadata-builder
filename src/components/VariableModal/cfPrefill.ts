/**
 * What selecting a CF standard name fills in, and how to undo it.
 *
 * Selecting a name prefills the long name and (for TA and DIC) the concentration
 * basis. It deliberately does not fill in the unit: the CF canonical unit is often
 * not what gets reported (a pH scale, PSU), so the unit field offers it as a
 * suggestion instead. It never touches dataset_variable_name either — that names a
 * column in the user's own data file, and only they know what it is called.
 *
 * A prefill may only overwrite an empty field or a value this picker put there
 * itself, so anything the user typed survives a later selection. `CfPrefilled` is
 * that memory; the modal holds one per open modal and clears it on open, which is
 * what stops the picker from rewriting a stored variable being edited.
 */

import { type CfEntry, toVocabularyItemReference } from "@/data/cf/cfStandardNames";
import { getConcentrationBasisFor, getLongNameFor, humanizeCfName } from "./cfShortlists";

/** Fields the CF standard name picker may prefill. */
export interface CfPrefilled {
  long_name?: string;
  concentration_basis?: string;
}

const PREFILLED_FIELDS = ["long_name", "concentration_basis"] as const;

export interface CfPrefillResult {
  data: Record<string, unknown>;
  prefilled: CfPrefilled;
}

function isOursToPrefill(
  data: Record<string, unknown>,
  prefilled: CfPrefilled,
  key: keyof CfPrefilled,
) {
  const current = data[key];
  return !current || current === prefilled[key];
}

/** Drops values still holding what the picker put there, leaving user edits alone. */
function revert(data: Record<string, unknown>, prefilled: CfPrefilled) {
  for (const key of PREFILLED_FIELDS) {
    if (prefilled[key] !== undefined && data[key] === prefilled[key]) delete data[key];
  }
}

export interface CfPrefillOptions {
  /**
   * Whether the variable's class has concentration_basis. ModelOutputVariable does
   * not, so writing it there would only be stripped again on save.
   */
  hasConcentrationBasis?: boolean;
}

/** Applies a CF selection, or clears the standard name when `entry` is null. */
export function applyCfSelection(
  formData: Record<string, unknown>,
  entry: CfEntry | null,
  prefilled: CfPrefilled,
  options: CfPrefillOptions = {},
): CfPrefillResult {
  const data = { ...formData };

  if (!entry) {
    delete data.standard_identifier;
    revert(data, prefilled);
    return { data, prefilled: {} };
  }

  // Written whole, never field by field: VocabularyItemReference requires both term
  // and uri, so a half-built object would fail validation on export.
  data.standard_identifier = toVocabularyItemReference(entry);

  const next: CfPrefilled = { ...prefilled };

  const longName = getLongNameFor(entry.name) ?? humanizeCfName(entry.name);
  if (isOursToPrefill(data, prefilled, "long_name")) {
    data.long_name = longName;
    next.long_name = longName;
  }

  // TA and DIC each have a per-volume and a per-mass CF name, and concentration_basis
  // is required on both — leaving it unset lets the two disagree.
  const basis =
    options.hasConcentrationBasis === false ? undefined : getConcentrationBasisFor(entry.name);
  if (isOursToPrefill(data, prefilled, "concentration_basis")) {
    if (basis) {
      data.concentration_basis = basis;
      next.concentration_basis = basis;
    } else if (prefilled.concentration_basis !== undefined) {
      // The new name says nothing about basis, so the one the picker wrote for
      // the previous name would now be stale.
      delete data.concentration_basis;
      delete next.concentration_basis;
    }
  }

  return { data, prefilled: next };
}

/**
 * Clears the standard name and what it prefilled, for when the variable type
 * changes. Callers must only invoke this on an actual change of type.
 *
 * The name identifies the quantity, so changing the quantity always invalidates it —
 * whether or not the new type has a shortlist. Testing membership of the shortlist
 * instead would be wrong in both directions now that "Search all standard names"
 * makes off-shortlist names legitimately selectable: it would discard a deliberate
 * off-shortlist choice, and it would let a pH name survive onto a sediment variable
 * purely because sediment has no shortlist to fail.
 */
export function clearCfSelectionOnTypeChange(
  formData: Record<string, unknown>,
  prefilled: CfPrefilled,
): CfPrefillResult {
  if (!formData.standard_identifier) return { data: formData, prefilled };

  const data = { ...formData };
  delete data.standard_identifier;
  revert(data, prefilled);
  return { data, prefilled: {} };
}
