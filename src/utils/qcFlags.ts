/**
 * QC flag column naming, shared by the checker and the template definitions.
 */

const QC_FLAG_PATTERNS = [/_flag$/i, /_qc$/i, /_quality$/i, /^qc_/i];

export function isQcFlagColumn(name: string): boolean {
  return QC_FLAG_PATTERNS.some((p) => p.test(name));
}

/** Strip the flag affix to get the variable name a QC column refers to. */
export function qcFlagBase(name: string): string {
  return name
    .replace(/_flag$/i, "")
    .replace(/_qc$/i, "")
    .replace(/_quality$/i, "")
    .replace(/^qc_/i, "")
    .toLowerCase();
}

/**
 * Pair a variable with its QC flag column.
 *
 * The exact forms (`depth` + `depth_flag`) are tried first. The templates then
 * need a looser rule, because they suffix the variable but not the flag:
 * `TEMP_flag` belongs to `TEMP_ITS90`, `Salinity_flag` to `Salinity_PSS78`,
 * `fCO2_SW_flag` to `fCO2_SW_SST`. And occasionally the flag is the longer name,
 * as with `doxygen_flag` for `doxy`.
 */
/** How well a flag column fits a variable, or 0 for no fit. */
function pairScore(variable: string, flag: string): number {
  const lower = variable.toLowerCase();
  const base = qcFlagBase(flag);
  if (base === "") return 0;

  const exact = [`${lower}_flag`, `${lower}_qc`, `${lower}_quality`, `qc_${lower}`];
  if (exact.includes(flag.toLowerCase())) return 1000;

  // The variable carries a scale or method suffix the flag omits, as with
  // TEMP_flag for TEMP_ITS90. Longer bases are more specific, so Salinity_flag
  // beats SAL_flag for Salinity_PSS78.
  if (lower.startsWith(base)) return 100 + base.length;

  // The flag spells the variable out more fully, as with doxygen_flag for doxy.
  if (lower.length >= 3 && base.startsWith(lower)) return 10 + lower.length;

  return 0;
}

/**
 * Assign each QC flag column to at most one variable.
 *
 * Bottle has TEMP_flag alongside TEMP_ITS90, TEMP_PH, TEMP_Carbonate and
 * TEMP_fCO2; scoring each variable independently hands the same flag to all
 * four. Pairing greedily from the best fit down keeps it one-to-one.
 */
export function pairQcFlags(headers: string[]): Map<string, string> {
  const flags = headers.filter(isQcFlagColumn);
  const variables = headers.filter((h) => !isQcFlagColumn(h));

  const candidates = variables
    .flatMap((variable) =>
      flags.map((flag) => ({ variable, flag, score: pairScore(variable, flag) })),
    )
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const pairs = new Map<string, string>();
  const claimed = new Set<string>();
  for (const { variable, flag } of candidates) {
    if (pairs.has(variable) || claimed.has(flag)) continue;
    pairs.set(variable, flag);
    claimed.add(flag);
  }
  return pairs;
}

export function findQcFlagFor(variableName: string, allHeaders: string[]): string | undefined {
  return pairQcFlags(allHeaders).get(variableName);
}
