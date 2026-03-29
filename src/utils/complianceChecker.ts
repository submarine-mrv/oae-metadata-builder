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
  { name: "ph_t_insitu", description: "pH on total scale at in-situ conditions", expectQcFlag: true },
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
  { name: "alkalinity_excess", description: "Excess alkalinity from OAE intervention", expectQcFlag: true },
  { name: "tracer_concentration", description: "Tracer concentration", expectQcFlag: true },
];

/** Set of all recommended variable names (lowercase) for fast lookup */
const RECOMMENDED_NAMES_SET = new Set(
  RECOMMENDED_VARIABLES.map((v) => v.name.toLowerCase())
);

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
  fileType: "csv" | "netcdf";
  columnHeaders: string[];
  checks: CheckResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

/**
 * Parse column headers from a CSV file's first line.
 */
export function parseCsvHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== "");
  if (!firstLine) return [];

  // Handle quoted CSV headers
  const headers: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      headers.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  headers.push(current.trim());

  return headers.filter((h) => h.length > 0);
}

/**
 * Extract variable names from a NetCDF file buffer.
 * Returns variable names and any units attributes found.
 */
export interface NetCdfVariableInfo {
  name: string;
  units?: string;
  attributes: Array<{ name: string; value: string | number }>;
}

export async function parseNetCdfVariables(
  buffer: ArrayBuffer
): Promise<NetCdfVariableInfo[]> {
  // Dynamic import to keep netcdfjs out of the initial bundle
  const { NetCDFReader } = await import("netcdfjs");
  const reader = new NetCDFReader(buffer);

  return reader.variables.map((v) => {
    const attrs = (v.attributes || []) as Array<{
      name: string;
      value: string | number;
    }>;
    const unitsAttr = attrs.find(
      (a) => a.name.toLowerCase() === "units"
    );
    return {
      name: v.name,
      units: unitsAttr ? String(unitsAttr.value) : undefined,
      attributes: attrs,
    };
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
  const candidates = [
    `${lower}_flag`,
    `${lower}_qc`,
    `${lower}_quality`,
    `qc_${lower}`,
  ];
  return allHeaders.find((h) => candidates.includes(h.toLowerCase()));
}

/**
 * Check 1: Column headers that match recommended variable names
 */
function checkRecommendedHeaders(headers: string[]): CheckResult[] {
  const results: CheckResult[] = [];
  const nonQcHeaders = headers.filter((h) => !isQcFlagColumn(h));
  const matched = nonQcHeaders.filter((h) =>
    RECOMMENDED_NAMES_SET.has(h.toLowerCase())
  );

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
  const unrecognized = nonQcHeaders.filter(
    (h) => !RECOMMENDED_NAMES_SET.has(h.toLowerCase())
  );

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
    const rec = RECOMMENDED_VARIABLES.find(
      (v) => v.name.toLowerCase() === h.toLowerCase()
    );
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
 * Check 4: Units information (NetCDF only — CSV files don't carry units metadata)
 */
function checkUnitsNetCdf(variables: NetCdfVariableInfo[]): CheckResult[] {
  const results: CheckResult[] = [];

  // Skip dimension/coordinate variables for units check
  const dataVars = variables.filter(
    (v) => !isQcFlagColumn(v.name)
  );

  const withUnits = dataVars.filter((v) => v.units);
  const withoutUnits = dataVars.filter((v) => !v.units);

  if (withUnits.length > 0) {
    results.push({
      severity: "pass",
      message: `${withUnits.length} variable${withUnits.length === 1 ? "" : "s"} have units defined`,
      details: withUnits.map((v) => `${v.name} (${v.units})`).join(", "),
    });
  }

  if (withoutUnits.length > 0) {
    results.push({
      severity: "warn",
      message: `${withoutUnits.length} variable${withoutUnits.length === 1 ? "" : "s"} missing units attribute`,
      details: withoutUnits.map((v) => v.name).join(", "),
    });
  }

  return results;
}

function checkUnitsCsv(): CheckResult[] {
  return [
    {
      severity: "warn",
      message:
        "CSV files do not carry units metadata. Ensure units are documented in the accompanying metadata JSON.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface CheckFileInput {
  file: File;
}

export async function runComplianceChecks(
  input: CheckFileInput
): Promise<ComplianceReport> {
  const { file } = input;
  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "csv" || ext === "tsv") {
    const text = await file.text();
    const headers = ext === "tsv" ? parseTsvHeaders(text) : parseCsvHeaders(text);

    const checks: CheckResult[] = [
      ...checkRecommendedHeaders(headers),
      ...checkUnrecognizedHeaders(headers),
      ...checkQcFlags(headers),
      ...checkUnitsCsv(),
    ];

    return buildReport(filename, "csv", headers, checks);
  }

  if (ext === "nc" || ext === "netcdf") {
    const buffer = await file.arrayBuffer();
    const variables = await parseNetCdfVariables(buffer);
    const headers = variables.map((v) => v.name);

    const checks: CheckResult[] = [
      ...checkRecommendedHeaders(headers),
      ...checkUnrecognizedHeaders(headers),
      ...checkQcFlags(headers),
      ...checkUnitsNetCdf(variables),
    ];

    return buildReport(filename, "netcdf", headers, checks);
  }

  throw new Error(
    `Unsupported file type: .${ext}. Please upload a CSV (.csv) or NetCDF (.nc) file.`
  );
}

function parseTsvHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== "");
  if (!firstLine) return [];
  return firstLine.split("\t").map((h) => h.trim()).filter((h) => h.length > 0);
}

function buildReport(
  filename: string,
  fileType: "csv" | "netcdf",
  columnHeaders: string[],
  checks: CheckResult[]
): ComplianceReport {
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) {
    summary[c.severity]++;
  }
  return { filename, fileType, columnHeaders, checks, summary };
}
