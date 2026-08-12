/**
 * Compliance Checker for OAE data files.
 *
 * Validates CSV and NetCDF files against the OAE Data Protocol's
 * recommended variable naming conventions, QC flag presence, and units.
 */

import {
  type DataFileTemplate,
  detectTemplate,
  findRecommendedColumn,
  getTemplate,
  matchTemplate,
  type TemplateId,
  type TemplateMatch,
} from "@/utils/dataFileTemplates";
import { PROTOCOL_COLUMN_STANDARDS } from "@/utils/protocolColumnStandards";
import { isQcFlagColumn, pairQcFlags } from "@/utils/qcFlags";

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
  /** The template the file was checked against, if any. */
  template?: DataFileTemplate;
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

/**
 * Which template to check against. "auto" detects one from the column names,
 * "none" skips template checks and uses the generic recommended-name list.
 */
export type TemplateSelection = TemplateId | "auto" | "none";

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
  /** CF standard_name attribute. NetCDF only; spreadsheets have nowhere to put it. */
  standardName?: string;
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
  | { kind: "numeric"; cells: Array<{ column: string; value: string }> }
  /** A stray note sits above the header, so we never reached the real one. */
  | { kind: "stray-note"; note: string }
  /** Nothing in the row reads as a unit, so it is probably the first record. */
  | { kind: "unrecognized"; sample: string[] };

export interface TabularParse {
  columns: ParsedColumn[];
  unitsRow: UnitsRow;
}

/** No unit is a bare number, so a numeric cell means we are looking at data. */
const isNumericCell = (cell: string) => cell.trim() !== "" && Number.isFinite(Number(cell));

/** Units the protocol's column header standards tables name. */
const KNOWN_UNITS = new Set(
  PROTOCOL_COLUMN_STANDARDS.map((c) => c.unit.trim().toLowerCase()).filter(
    (u) => u !== "" && !NOT_APPLICABLE.has(u),
  ),
);

/**
 * A units row has to look like units, not just avoid looking like data.
 *
 * Numbers alone don't catch a file whose first record is all text — identifiers,
 * dates, operator names — which would otherwise be read as units for every
 * column. So we also want one positive signal: a unit the protocol names, or an
 * explicit "no units apply" marker, both of which every template's units row has.
 */
const looksLikeUnits = (cell: string) => {
  const value = cell.trim().toLowerCase();
  return value !== "" && (NOT_APPLICABLE.has(value) || KNOWN_UNITS.has(value));
};

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

  // physiological.xlsx carries an unprefixed "(example response variables)" note
  // between the preamble and the header. A header row narrower than the row
  // under it means we stopped on a note like that rather than the real header.
  const filled = (r: string[]) => r.filter((cell) => cell.trim() !== "").length;
  if (row && filled(header) < filled(row)) {
    return {
      columns: [],
      unitsRow: { kind: "stray-note", note: named.map((c) => c.name).join(", ") },
    };
  }
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

  if (!row.some(looksLikeUnits)) {
    return {
      columns: named.map((c) => ({ name: c.name, units: { kind: "missing" } })),
      unitsRow: { kind: "unrecognized", sample: row.filter((c) => c.trim() !== "").slice(0, 6) },
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
    const attr = (name: string) =>
      attrs.find((a) => a.name.toLowerCase() === name)?.value as string | undefined;
    const standardName = String(attr("standard_name") ?? "").trim();
    return {
      name: v.name,
      units: toUnits(attr("units")),
      standardName: standardName === "" ? undefined : standardName,
    };
  });
}

// ---------------------------------------------------------------------------
// Check implementations
// ---------------------------------------------------------------------------

/**
 * Check 1: Column headers that match recommended variable names
 */
function checkRecommendedHeaders(headers: string[]): CheckResult[] {
  const results: CheckResult[] = [];
  const nonQcHeaders = headers.filter((h) => !isQcFlagColumn(h));
  const matched = nonQcHeaders.filter((h) => findRecommendedColumn(h) !== undefined);

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
  const unrecognized = nonQcHeaders.filter((h) => findRecommendedColumn(h) === undefined);

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
function checkQcFlags(headers: string[], template?: DataFileTemplate): CheckResult[] {
  const results: CheckResult[] = [];
  const nonQcHeaders = headers.filter((h) => !isQcFlagColumn(h));

  // When we know which template the file follows, that template decides which
  // columns carry a flag. The union across templates would expect one wherever
  // any template pairs it, and warn about a pristine file — flow through and
  // autonomous have no flag for temp_ITS90, physiological has none at all.
  const templatePairs = template ? pairQcFlags(template.columns) : undefined;
  const expectsFlag = (h: string) =>
    templatePairs ? templatePairs.has(h) : Boolean(findRecommendedColumn(h)?.expectQcFlag);

  const varsNeedingQc = nonQcHeaders.filter(expectsFlag);
  // One pairing drives present, missing and orphan alike, so they agree.
  const pairs = pairQcFlags(headers);

  const missingQc: string[] = [];
  const presentQc: string[] = [];

  for (const v of varsNeedingQc) {
    const qcCol = pairs.get(v);
    if (qcCol) {
      presentQc.push(v);
    } else {
      missingQc.push(v);
    }
  }

  if (presentQc.length > 0) {
    results.push({
      severity: "pass",
      message:
        presentQc.length === 1
          ? "1 variable has a QC flag column"
          : `${presentQc.length} variables have QC flag columns`,
      details: presentQc.join(", "),
    });
  }

  if (missingQc.length > 0) {
    results.push({
      severity: "warn",
      message:
        missingQc.length === 1
          ? "1 variable is missing a QC flag column"
          : `${missingQc.length} variables are missing QC flag columns`,
      details: missingQc.join(", "),
    });
  }

  // Orphans are QC flags no variable claims. Uses the same pairing rule as
  // above, so the two checks cannot disagree about a given column.
  const qcHeaders = headers.filter((h) => isQcFlagColumn(h));
  const claimed = new Set(pairs.values());
  const orphanQc = qcHeaders.filter((h) => !claimed.has(h));

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

/**
 * Check the file's columns against a specific template. Replaces the generic
 * recommended-name check, which uses a different vocabulary from the templates.
 */
function checkTemplate(match: TemplateMatch): CheckResult[] {
  const { template, matched, extra } = match;
  const results: CheckResult[] = [
    {
      severity: "pass",
      message: `${matched.length} of ${template.columns.length} ${template.label} template columns present`,
      details: matched.join(", "),
    },
  ];

  if (extra.length > 0) {
    results.push({
      severity: "warn",
      message: `${extra.length} column${extra.length === 1 ? "" : "s"} not in the ${template.label} template`,
      details: extra.join(", "),
    });
  }

  // Absent template columns are not reported. The templates are "common
  // recommended" names, not a required set — a file that uses a subset is fine,
  // and the matched count above already says how much of the template it covers.
  return results;
}

/** A missing or data-filled units row fails the file outright. */
function describeUnitsRow(unitsRow: Exclude<UnitsRow, { kind: "ok" }>): CheckResult {
  if (unitsRow.kind === "stray-note") {
    return {
      severity: "fail",
      message: "Unexpected row above the column headers",
      details:
        `Found "${unitsRow.note}" where the column headers should be. ` +
        "Delete any note above the header row, or prefix it with # in the first column, " +
        "so the header row comes first.",
    };
  }

  if (unitsRow.kind === "unrecognized") {
    return {
      severity: "fail",
      message: "No recognizable units below the column headers",
      details:
        `Found ${unitsRow.sample.map((c) => `"${c}"`).join(", ")}. ` +
        "The row immediately below the headers must hold units. " +
        'Use "n.a." where units do not apply.',
    };
  }

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

export function checkCsv(
  filename: string,
  text: string,
  selection: TemplateSelection = "auto",
): ComplianceReport {
  const delimiter = filename.toLowerCase().endsWith(".tsv") ? "\t" : ",";
  const parsed = parseDelimitedColumns(text, delimiter);
  return buildReport(filename, "csv", parsed.columns, parsed.unitsRow, selection);
}

export async function checkExcel(
  filename: string,
  buffer: ArrayBuffer,
  selection: TemplateSelection = "auto",
): Promise<ComplianceReport> {
  const parsed = await parseExcelColumns(buffer);
  return buildReport(filename, "xlsx", parsed.columns, parsed.unitsRow, selection);
}

export async function checkNetCdf(
  filename: string,
  buffer: ArrayBuffer,
): Promise<ComplianceReport> {
  // NetCDF carries units per variable attribute; there is no units row, and the
  // templates are spreadsheet layouts, so no template check applies.
  return buildReport(filename, "netcdf", await parseNetCdfColumns(buffer), undefined, "none");
}

export async function runComplianceChecks(
  file: File,
  selection: TemplateSelection = "auto",
): Promise<ComplianceReport> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv" || ext === "tsv") {
    return checkCsv(file.name, await readAsText(file), selection);
  }
  if (ext === "xlsx" || ext === "xls") {
    return checkExcel(file.name, await readAsArrayBuffer(file), selection);
  }
  if (ext === "nc" || ext === "netcdf") {
    return checkNetCdf(file.name, await readAsArrayBuffer(file));
  }

  throw new Error(
    `Unsupported file type: .${ext}. Please upload a CSV, Excel (.xlsx), or NetCDF (.nc) file.`,
  );
}

/** Every format runs the same checks, so the reports read the same. */
function runChecks(
  columns: ParsedColumn[],
  fileType: ComplianceReport["fileType"],
  unitsRow?: UnitsRow,
  match?: TemplateMatch,
): CheckResult[] {
  // A stray note means we never found the header row, so say that rather than
  // reporting the note itself as a missing header.
  if (unitsRow?.kind === "stray-note") return [describeUnitsRow(unitsRow)];

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

  // QC flag expectations are derived from the spreadsheet templates, so they
  // say nothing about a NetCDF file. Units still apply to both.
  if (fileType === "netcdf") {
    // Variable names are deliberately not judged; CF carries the vocabulary in
    // standard_name, and QC flag conventions come from the spreadsheet templates.
    return [...checkStandardNames(columns), ...checkUnits(columns, unitsRow)];
  }

  return [
    ...checkNaming(headers, match),
    ...checkQcFlags(headers, match?.template),
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

/**
 * Which names to judge a spreadsheet's columns against: the specific template
 * when we know which one it is, otherwise the recommended set as a whole.
 */
function checkNaming(headers: string[], match?: TemplateMatch): CheckResult[] {
  if (match) return checkTemplate(match);

  return [...checkRecommendedHeaders(headers), ...checkUnrecognizedHeaders(headers)];
}

/**
 * CF is the protocol's rule for model output: "For model output variable names,
 * please refer to the CF naming conventions." CF does not standardise variable
 * names — it standardises the `standard_name` attribute — so that attribute is
 * what we check, and the variable name itself is left alone.
 */
function checkStandardNames(columns: ParsedColumn[]): CheckResult[] {
  const named = columns.filter((c) => c.standardName);
  const unnamed = columns.filter((c) => !c.standardName);
  const results: CheckResult[] = [];

  if (named.length > 0) {
    results.push({
      severity: "pass",
      message: `${named.length} of ${columns.length} variables declare a CF standard_name`,
      details: named.map((c) => `${c.name} (${c.standardName})`).join(", "),
    });
  }

  if (unnamed.length > 0) {
    results.push({
      severity: "warn",
      message: `${unnamed.length} variable${unnamed.length === 1 ? "" : "s"} missing a CF standard_name`,
      details: `${unnamed.map((c) => c.name).join(", ")}. The protocol defers model output naming to CF conventions, which identify a quantity through the standard_name attribute rather than the variable name.`,
    });
  }

  return results;
}

function resolveTemplate(
  headers: string[],
  selection: TemplateSelection,
): TemplateMatch | undefined {
  if (selection === "none") return undefined;
  if (selection === "auto") return detectTemplate(headers);
  const template = getTemplate(selection);
  return template ? matchTemplate(headers, template) : undefined;
}

function buildReport(
  filename: string,
  fileType: ComplianceReport["fileType"],
  columns: ParsedColumn[],
  unitsRow?: UnitsRow,
  selection: TemplateSelection = "auto",
): ComplianceReport {
  const match = resolveTemplate(
    columns.map((c) => c.name),
    selection,
  );
  const checks = runChecks(columns, fileType, unitsRow, match);
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) {
    summary[c.severity]++;
  }
  return { filename, fileType, columns, template: match?.template, checks, summary };
}
