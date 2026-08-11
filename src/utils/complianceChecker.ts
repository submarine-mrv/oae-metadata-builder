/**
 * Compliance Checker for OAE data files.
 *
 * Validates CSV and NetCDF files against the OAE Data Protocol's
 * recommended variable naming conventions, QC flag presence, and units.
 */

// ---------------------------------------------------------------------------
// Recommended column header names from the OAE Data Protocol
// See: https://www.carbontosea.org/oae-data-protocol/1-0-0/#column-header-name
// ---------------------------------------------------------------------------

export interface RecommendedVariable {
  name: string;
  description: string;
  /** Whether a QC flag column is expected alongside this variable */
  expectQcFlag: boolean;
}

/**
 * Curated list of recommended column header names from the OAE Data Protocol.
 * These are the standard names that should appear in dataset data files.
 */
export const RECOMMENDED_VARIABLES: RecommendedVariable[] = [
  // Identifiers & coordinates
  { name: "sample_id", description: "Unique sample identifier", expectQcFlag: false },
  { name: "station_id", description: "Station identifier", expectQcFlag: false },
  { name: "cast_id", description: "Cast identifier", expectQcFlag: false },
  { name: "date", description: "Date of observation", expectQcFlag: false },
  { name: "time", description: "Time of observation", expectQcFlag: false },
  { name: "datetime", description: "Combined date and time", expectQcFlag: false },
  { name: "latitude", description: "Latitude in decimal degrees", expectQcFlag: false },
  { name: "longitude", description: "Longitude in decimal degrees", expectQcFlag: false },
  { name: "depth", description: "Depth in meters", expectQcFlag: true },
  { name: "pressure", description: "Pressure in decibars", expectQcFlag: true },

  // Physical oceanography
  { name: "temperature", description: "Water temperature", expectQcFlag: true },
  { name: "salinity", description: "Salinity", expectQcFlag: true },
  { name: "conductivity", description: "Conductivity", expectQcFlag: true },
  { name: "density", description: "Water density", expectQcFlag: true },
  { name: "sigma_theta", description: "Potential density anomaly", expectQcFlag: true },

  // Carbonate chemistry
  { name: "dic", description: "Dissolved inorganic carbon", expectQcFlag: true },
  { name: "ta", description: "Total alkalinity", expectQcFlag: true },
  {
    name: "ph_t_insitu",
    description: "pH on total scale at in-situ conditions",
    expectQcFlag: true,
  },
  { name: "ph_t_25", description: "pH on total scale at 25C", expectQcFlag: true },
  { name: "pco2", description: "Partial pressure of CO2", expectQcFlag: true },
  { name: "fco2", description: "Fugacity of CO2", expectQcFlag: true },
  { name: "xco2", description: "Mole fraction of CO2", expectQcFlag: true },
  { name: "omega_ar", description: "Aragonite saturation state", expectQcFlag: true },
  { name: "omega_ca", description: "Calcite saturation state", expectQcFlag: true },
  { name: "co3", description: "Carbonate ion concentration", expectQcFlag: true },
  { name: "hco3", description: "Bicarbonate ion concentration", expectQcFlag: true },
  { name: "revelle_factor", description: "Revelle factor", expectQcFlag: true },

  // Dissolved gases
  { name: "do", description: "Dissolved oxygen", expectQcFlag: true },
  { name: "do_sat", description: "Dissolved oxygen saturation", expectQcFlag: true },

  // Nutrients
  { name: "no3", description: "Nitrate", expectQcFlag: true },
  { name: "no2", description: "Nitrite", expectQcFlag: true },
  { name: "nh4", description: "Ammonium", expectQcFlag: true },
  { name: "po4", description: "Phosphate", expectQcFlag: true },
  { name: "si", description: "Silicate", expectQcFlag: true },

  // Biological
  { name: "chl_a", description: "Chlorophyll-a", expectQcFlag: true },
  { name: "turbidity", description: "Turbidity", expectQcFlag: true },
  { name: "fluorescence", description: "Fluorescence", expectQcFlag: true },

  // OAE-specific
  {
    name: "alkalinity_excess",
    description: "Excess alkalinity from OAE intervention",
    expectQcFlag: true,
  },
  { name: "tracer_concentration", description: "Tracer concentration", expectQcFlag: true },
];

/** Set of all recommended variable names (lowercase) for fast lookup */
const RECOMMENDED_NAMES_SET = new Set(RECOMMENDED_VARIABLES.map((v) => v.name.toLowerCase()));

// ---------------------------------------------------------------------------
// Check result types
// ---------------------------------------------------------------------------

export type CheckSeverity = "pass" | "warn" | "fail";

export interface CheckResult {
  severity: CheckSeverity;
  message: string;
  details?: string;
}

export interface ComplianceReport {
  filename: string;
  fileType: "csv" | "xlsx" | "netcdf";
  columns: ParsedColumn[];
  checks: CheckResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}

// ---------------------------------------------------------------------------
// Columns and units
//
// Spreadsheets and NetCDF both reduce to ParsedColumn[] so the checks and the
// report look the same whichever format the file came in as.
// ---------------------------------------------------------------------------

/** Units as the file declares them, which is not the same as units we know. */
export type Units =
  | { kind: "declared"; value: string }
  /** The file says units don't apply here, e.g. the templates' "n.a.". */
  | { kind: "not-applicable" }
  /** The file says nothing either way. */
  | { kind: "missing" };

export interface ParsedColumn {
  name: string;
  units: Units;
}

/** Spellings the protocol templates use for "no units apply". */
const NOT_APPLICABLE = new Set(["n.a.", "n.a", "na", "n/a", "none", "-", "--"]);

export function toUnits(raw: string | undefined | null): Units {
  const value = String(raw ?? "").trim();
  if (value === "") return { kind: "missing" };
  if (NOT_APPLICABLE.has(value.toLowerCase())) return { kind: "not-applicable" };
  return { kind: "declared", value };
}

/** Label for a units value, used by both the report UI and check details. */
export function unitsLabel(units: Units): string {
  if (units.kind === "declared") return units.value;
  return units.kind === "not-applicable" ? "not applicable" : "not declared";
}

// ---------------------------------------------------------------------------
// Tabular parsing (CSV, TSV, Excel)
// ---------------------------------------------------------------------------

const isBlankRow = (row: string[]) => row.every((cell) => cell.trim() === "");

/**
 * Comment rows can sit anywhere above or between the header and units rows, but
 * the "#" is always in the first column — that is how every protocol template
 * writes them, including the bare "#" row that sits just above the header.
 */
const isCommentRow = (row: string[]) => (row[0] ?? "").trim().startsWith("#");

/**
 * The protocol requires a units row: "the column header name in the top cell,
 * and the units in one cell immediately below the column header name, with data
 * values following". So the row under the header is the units row by position,
 * and a file without one is non-conformant rather than merely undocumented.
 */
export type UnitsRow =
  | { kind: "ok" }
  /** Nothing below the header at all. */
  | { kind: "absent" }
  /** Numbers below the header, so that row is data — the units row is missing. */
  | { kind: "numeric"; cells: Array<{ column: string; value: string }> };

export interface TabularParse {
  columns: ParsedColumn[];
  unitsRow: UnitsRow;
}

/** No unit is a bare number, so a numeric cell means we are looking at data. */
const isNumericCell = (cell: string) => cell.trim() !== "" && Number.isFinite(Number(cell));

/**
 * Reduce raw rows to columns. Rows beginning with "#" are metadata comments and
 * are skipped; the first row left is the header and the next one is the units row.
 */
export function parseTabularColumns(rows: string[][]): TabularParse {
  const body = rows.filter((row) => !isBlankRow(row) && !isCommentRow(row));
  const header = body[0];
  if (!header) return { columns: [], unitsRow: { kind: "absent" } };

  // Positions are kept while pairing header to units; unnamed columns drop after.
  const named = header
    .map((name, i) => ({ name: name.trim(), index: i }))
    .filter((c) => c.name !== "");

  const row = body[1];
  if (!row) {
    return {
      columns: named.map((c) => ({ name: c.name, units: { kind: "missing" } })),
      unitsRow: { kind: "absent" },
    };
  }

  const numeric = named
    .filter((c) => isNumericCell(row[c.index] ?? ""))
    .map((c) => ({ column: c.name, value: (row[c.index] ?? "").trim() }));

  if (numeric.length > 0) {
    // Don't label columns with values from a data row.
    return {
      columns: named.map((c) => ({ name: c.name, units: { kind: "missing" } })),
      unitsRow: { kind: "numeric", cells: numeric },
    };
  }

  return {
    columns: named.map((c) => ({ name: c.name, units: toUnits(row[c.index]) })),
    unitsRow: { kind: "ok" },
  };
}

/** Split one delimited line, honouring double quotes. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseDelimitedColumns(text: string, delimiter = ","): TabularParse {
  const rows = text.split(/\r?\n/).map((line) => splitLine(line, delimiter));
  return parseTabularColumns(rows);
}

export async function parseExcelColumns(buffer: ArrayBuffer): Promise<TabularParse> {
  const XLSX = await import("xlsx");
  // type "array" means Uint8Array. Handed a bare ArrayBuffer, SheetJS falls
  // back to reading the zip bytes as text and yields one garbage column.
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return { columns: [], unitsRow: { kind: "absent" } };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  return parseTabularColumns(rows.map((row) => row.map((cell) => String(cell ?? ""))));
}

/** Column headers only. Kept for callers that don't care about units. */
export function parseCsvHeaders(text: string): string[] {
  return parseDelimitedColumns(text).columns.map((c) => c.name);
}

// ---------------------------------------------------------------------------
// NetCDF parsing
// ---------------------------------------------------------------------------

export async function parseNetCdfColumns(buffer: ArrayBuffer): Promise<ParsedColumn[]> {
  // Dynamic import to keep netcdfjs out of the initial bundle
  const { NetCDFReader } = await import("netcdfjs");
  const reader = new NetCDFReader(buffer);

  return reader.variables.map((v) => {
    const attrs = (v.attributes || []) as Array<{ name: string; value: string | number }>;
    const unitsAttr = attrs.find((a) => a.name.toLowerCase() === "units");
    return { name: v.name, units: toUnits(unitsAttr?.value as string | undefined) };
  });
}

// ---------------------------------------------------------------------------
// Check implementations
// ---------------------------------------------------------------------------

/** QC flag column name patterns */
const QC_FLAG_PATTERNS = [/_flag$/i, /_qc$/i, /_quality$/i, /^qc_/i];

function isQcFlagColumn(name: string): boolean {
  return QC_FLAG_PATTERNS.some((p) => p.test(name));
}

function findQcFlagFor(variableName: string, allHeaders: string[]): string | undefined {
  const lower = variableName.toLowerCase();
  const candidates = [`${lower}_flag`, `${lower}_qc`, `${lower}_quality`, `qc_${lower}`];
  return allHeaders.find((h) => candidates.includes(h.toLowerCase()));
}

/**
 * Check 1: Column headers that match recommended variable names
 */
function checkRecommendedHeaders(headers: string[]): CheckResult[] {
  const results: CheckResult[] = [];
  const nonQcHeaders = headers.filter((h) => !isQcFlagColumn(h));
  const matched = nonQcHeaders.filter((h) => RECOMMENDED_NAMES_SET.has(h.toLowerCase()));

  if (matched.length > 0) {
    results.push({
      severity: "pass",
      message: `${matched.length} column${matched.length === 1 ? "" : "s"} match recommended variable names`,
      details: matched.join(", "),
    });
  }

  return results;
}

/**
 * Check 2: Column headers NOT in the recommended list
 */
function checkUnrecognizedHeaders(headers: string[]): CheckResult[] {
  const results: CheckResult[] = [];
  const nonQcHeaders = headers.filter((h) => !isQcFlagColumn(h));
  const unrecognized = nonQcHeaders.filter((h) => !RECOMMENDED_NAMES_SET.has(h.toLowerCase()));

  if (unrecognized.length > 0) {
    results.push({
      severity: "warn",
      message: `${unrecognized.length} column${unrecognized.length === 1 ? "" : "s"} not in recommended list`,
      details: unrecognized.join(", "),
    });
  } else if (nonQcHeaders.length > 0) {
    results.push({
      severity: "pass",
      message: "All columns use recommended variable names",
    });
  }

  return results;
}

/**
 * Check 3: QC flag columns present for variables that should have them
 */
function checkQcFlags(headers: string[]): CheckResult[] {
  const results: CheckResult[] = [];
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const nonQcHeaders = headers.filter((h) => !isQcFlagColumn(h));

  // Only check recommended variables that expect QC flags and are present in the file
  const varsNeedingQc = nonQcHeaders.filter((h) => {
    const rec = RECOMMENDED_VARIABLES.find((v) => v.name.toLowerCase() === h.toLowerCase());
    return rec?.expectQcFlag;
  });

  const missingQc: string[] = [];
  const presentQc: string[] = [];

  for (const v of varsNeedingQc) {
    const qcCol = findQcFlagFor(v, lowerHeaders);
    if (qcCol) {
      presentQc.push(v);
    } else {
      missingQc.push(v);
    }
  }

  if (presentQc.length > 0) {
    results.push({
      severity: "pass",
      message: `${presentQc.length} variable${presentQc.length === 1 ? "" : "s"} have QC flag columns`,
      details: presentQc.join(", "),
    });
  }

  if (missingQc.length > 0) {
    results.push({
      severity: "warn",
      message: `${missingQc.length} variable${missingQc.length === 1 ? "" : "s"} missing QC flag columns`,
      details: missingQc.join(", "),
    });
  }

  // Check for orphan QC flag columns (QC flags without matching variables)
  const qcHeaders = headers.filter((h) => isQcFlagColumn(h));
  const orphanQc = qcHeaders.filter((qcH) => {
    // Strip suffixes to find the base variable name
    const base = qcH
      .replace(/_flag$/i, "")
      .replace(/_qc$/i, "")
      .replace(/_quality$/i, "")
      .replace(/^qc_/i, "");
    return !lowerHeaders.includes(base.toLowerCase());
  });

  if (orphanQc.length > 0) {
    results.push({
      severity: "warn",
      message: `${orphanQc.length} QC flag column${orphanQc.length === 1 ? "" : "s"} without matching variable`,
      details: orphanQc.join(", "),
    });
  }

  return results;
}

/**
 * Check 4: Units, from a spreadsheet's units row or a NetCDF units attribute.
 *
 * QC flag columns are excluded — a flag is a code, not a measurement.
 */
function checkUnits(columns: ParsedColumn[], unitsRow?: UnitsRow): CheckResult[] {
  const results: CheckResult[] = [];
  const measured = columns.filter((c) => !isQcFlagColumn(c.name));
  if (measured.length === 0) return results;

  const rowProblem = unitsRow && unitsRow.kind !== "ok" ? describeUnitsRow(unitsRow) : undefined;
  if (rowProblem) return [rowProblem];

  const declared = measured.filter((c) => c.units.kind === "declared");
  const notApplicable = measured.filter((c) => c.units.kind === "not-applicable");
  const missing = measured.filter((c) => c.units.kind === "missing");

  if (declared.length === 0 && notApplicable.length === 0) {
    results.push({
      severity: "warn",
      message: "No units declared for any column",
      details: "NetCDF variables should carry a units attribute.",
    });
    return results;
  }

  if (declared.length > 0) {
    results.push({
      severity: "pass",
      message: `${declared.length} of ${measured.length} column${measured.length === 1 ? "" : "s"} declare units`,
      details: tallyUnits(declared),
    });
  }

  if (notApplicable.length > 0) {
    results.push({
      severity: "pass",
      message: `${notApplicable.length} column${notApplicable.length === 1 ? "" : "s"} marked not applicable`,
      details: notApplicable.map((c) => c.name).join(", "),
    });
  }

  if (missing.length > 0) {
    results.push({
      severity: "warn",
      message: `${missing.length} column${missing.length === 1 ? "" : "s"} missing units`,
      details: missing.map((c) => c.name).join(", "),
    });
  }

  return results;
}

/** A missing or data-filled units row fails the file outright. */
function describeUnitsRow(unitsRow: Exclude<UnitsRow, { kind: "ok" }>): CheckResult {
  if (unitsRow.kind === "absent") {
    return {
      severity: "fail",
      message: "No units row",
      details:
        "The row immediately below the column headers must hold the units for each column. " +
        'Use "n.a." where units do not apply.',
    };
  }

  const shown = unitsRow.cells.slice(0, 8).map((c) => `${c.column} = ${c.value}`);
  const extra = unitsRow.cells.length - shown.length;
  return {
    severity: "fail",
    message: `Units row contains ${unitsRow.cells.length} numeric value${unitsRow.cells.length === 1 ? "" : "s"}`,
    details:
      `${shown.join(", ")}${extra > 0 ? `, and ${extra} more` : ""}. ` +
      "Numbers are data, not units, so the row below the headers looks like the first record. " +
      'Insert a units row, using "n.a." where units do not apply.',
  };
}

/** "umol/kg (4), deg_C (2)" — repeated spellings of one unit stand out here. */
function tallyUnits(columns: ParsedColumn[]): string {
  const counts = new Map<string, number>();
  for (const c of columns) {
    const label = unitsLabel(c.units);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, n]) => `${label} (${n})`)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Entry points
//
// These take already-read bytes rather than a File so they can be exercised
// directly by tests. runComplianceChecks is the thin File adapter over them.
// ---------------------------------------------------------------------------

export function checkCsv(filename: string, text: string): ComplianceReport {
  const delimiter = filename.toLowerCase().endsWith(".tsv") ? "\t" : ",";
  const parsed = parseDelimitedColumns(text, delimiter);
  return buildReport(filename, "csv", parsed.columns, parsed.unitsRow);
}

export async function checkExcel(filename: string, buffer: ArrayBuffer): Promise<ComplianceReport> {
  const parsed = await parseExcelColumns(buffer);
  return buildReport(filename, "xlsx", parsed.columns, parsed.unitsRow);
}

export async function checkNetCdf(
  filename: string,
  buffer: ArrayBuffer,
): Promise<ComplianceReport> {
  // NetCDF carries units per variable attribute; there is no units row.
  return buildReport(filename, "netcdf", await parseNetCdfColumns(buffer));
}

export async function runComplianceChecks(file: File): Promise<ComplianceReport> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv" || ext === "tsv") {
    return checkCsv(file.name, await readAsText(file));
  }
  if (ext === "xlsx" || ext === "xls") {
    return checkExcel(file.name, await readAsArrayBuffer(file));
  }
  if (ext === "nc" || ext === "netcdf") {
    return checkNetCdf(file.name, await readAsArrayBuffer(file));
  }

  throw new Error(
    `Unsupported file type: .${ext}. Please upload a CSV, Excel (.xlsx), or NetCDF (.nc) file.`,
  );
}

/** Every format runs the same checks, so the reports read the same. */
function runChecks(columns: ParsedColumn[], unitsRow?: UnitsRow): CheckResult[] {
  if (columns.length === 0) {
    return [
      {
        severity: "fail",
        message: "No column headers detected",
        details: "The file appears to be empty or could not be parsed.",
      },
    ];
  }

  const headers = columns.map((c) => c.name);
  return [
    ...checkRecommendedHeaders(headers),
    ...checkUnrecognizedHeaders(headers),
    ...checkQcFlags(headers),
    ...checkUnits(columns, unitsRow),
  ];
}

// FileReader rather than file.text() / file.arrayBuffer(): jsdom implements
// neither, and this matches importMetadata in exportImport.ts.
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

function buildReport(
  filename: string,
  fileType: ComplianceReport["fileType"],
  columns: ParsedColumn[],
  unitsRow?: UnitsRow,
): ComplianceReport {
  const checks = runChecks(columns, unitsRow);
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) {
    summary[c.severity]++;
  }
  return { filename, fileType, columns, checks, summary };
}
