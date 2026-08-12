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
export function findQcFlagFor(variableName: string, allHeaders: string[]): string | undefined {
  const lower = variableName.toLowerCase();
  const exact = [`${lower}_flag`, `${lower}_qc`, `${lower}_quality`, `qc_${lower}`];

  const flags = allHeaders.filter((h) => isQcFlagColumn(h));
  const exactMatch = flags.find((h) => exact.includes(h.toLowerCase()));
  if (exactMatch) return exactMatch;

  // Longest base first, so Salinity_PSS78 takes Salinity_flag rather than
  // SAL_flag, leaving SAL_flag for SAL_PSS78.
  return flags
    .map((h) => ({ header: h, base: qcFlagBase(h) }))
    .filter(({ base }) => {
      if (base === "") return false;
      // The variable carries a scale or method suffix the flag omits.
      if (lower.startsWith(base)) return true;
      // The flag spells the variable out more fully than the column does.
      return lower.length >= 3 && base.startsWith(lower);
    })
    .sort((a, b) => b.base.length - a.base.length)[0]?.header;
}
