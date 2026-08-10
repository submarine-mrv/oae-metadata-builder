// tsconfig.app.json omits "node" from types so app code stays browser-only.
// This test reads fixtures off disk, so it pulls the Node types in on its own.
/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ComplianceReport,
  checkCsv,
  checkExcel,
  checkNetCdf,
  type ParsedColumn,
  parseCsvHeaders,
  parseDelimitedColumns,
  RECOMMENDED_VARIABLES,
  unitsLabel,
} from "../complianceChecker";

// Fixtures in tests/samples/ are also the files you drag onto /checker by hand,
// so these assertions and the manual results stay in step. Vitest runs from the
// repo root.
const sampleText = (name: string) => readFileSync(path.resolve("tests/samples", name), "utf-8");

const sampleBytes = (name: string): ArrayBuffer => {
  const b = readFileSync(path.resolve("tests/samples", name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

const messages = (report: ComplianceReport, severity: string) =>
  report.checks.filter((c) => c.severity === severity).map((c) => c.message);

const unitsOf = (columns: ParsedColumn[], name: string) =>
  unitsLabel(columns.find((c) => c.name === name)?.units ?? { kind: "missing" });

describe("parseCsvHeaders", () => {
  it("parses simple comma-separated headers", () => {
    const text = "temperature,salinity,depth\n1.0,35.0,10";
    expect(parseCsvHeaders(text)).toEqual(["temperature", "salinity", "depth"]);
  });

  it("handles quoted headers with commas", () => {
    const text = '"station,id",temperature,salinity';
    expect(parseCsvHeaders(text)).toEqual(["station,id", "temperature", "salinity"]);
  });

  it("trims whitespace from headers", () => {
    const text = "  temperature , salinity , depth  ";
    expect(parseCsvHeaders(text)).toEqual(["temperature", "salinity", "depth"]);
  });

  it("skips empty leading lines", () => {
    const text = "\n\ntemperature,salinity\n1.0,35.0";
    expect(parseCsvHeaders(text)).toEqual(["temperature", "salinity"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCsvHeaders("")).toEqual([]);
  });

  it("filters out empty headers from trailing commas", () => {
    const text = "temperature,salinity,";
    // trailing comma produces an empty string that gets filtered
    expect(parseCsvHeaders(text)).toEqual(["temperature", "salinity"]);
  });
});

describe("RECOMMENDED_VARIABLES", () => {
  it("contains expected carbonate chemistry variables", () => {
    const names = RECOMMENDED_VARIABLES.map((v) => v.name);
    expect(names).toContain("dic");
    expect(names).toContain("ta");
    expect(names).toContain("ph_t_insitu");
    expect(names).toContain("pco2");
  });

  it("contains coordinate variables", () => {
    const names = RECOMMENDED_VARIABLES.map((v) => v.name);
    expect(names).toContain("latitude");
    expect(names).toContain("longitude");
    expect(names).toContain("depth");
  });

  it("marks coordinate variables correctly for QC flags", () => {
    const lat = RECOMMENDED_VARIABLES.find((v) => v.name === "latitude");
    expect(lat?.expectQcFlag).toBe(false);
    const depth = RECOMMENDED_VARIABLES.find((v) => v.name === "depth");
    expect(depth?.expectQcFlag).toBe(true);
  });

  it("has unique names", () => {
    const names = RECOMMENDED_VARIABLES.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("comment preamble and units row", () => {
  it("skips # lines and takes the first real row as the header", () => {
    const columns = parseDelimitedColumns(
      ["# Project ID: X", "# Template version: 1.0.1", "a,b", "m,degC", "1,2"].join("\n"),
    );

    expect(columns.map((c) => c.name)).toEqual(["a", "b"]);
  });

  it("reads the row under the header as units", () => {
    const columns = parseDelimitedColumns("depth,temperature\nm,deg_C\n5.0,13.4");

    expect(unitsOf(columns, "depth")).toBe("m");
    expect(unitsOf(columns, "temperature")).toBe("deg_C");
  });

  it("treats n.a. spellings as not applicable rather than a unit", () => {
    const columns = parseDelimitedColumns("a,b,c,d\nn.a.,N/A,none,-\n1,2,3,4");

    expect(columns.map((c) => c.units.kind)).toEqual(Array(4).fill("not-applicable"));
  });

  it("does not mistake a first data row for units", () => {
    // A plain CSV goes straight to data. Reading row 2 as units regardless would
    // label every column with a measurement.
    const columns = parseDelimitedColumns("depth,temperature\n5.0,13.4\n25.0,12.1");

    expect(columns.map((c) => c.units.kind)).toEqual(["missing", "missing"]);
  });

  it("keeps units aligned with headers when a units cell is blank", () => {
    const columns = parseDelimitedColumns("a,b,c\nm,,umol/kg\n1,2,3");

    expect(columns.map((c) => unitsLabel(c.units))).toEqual(["m", "not declared", "umol/kg"]);
  });
});

describe("checkCsv", () => {
  it("passes a fully compliant file with no warnings", () => {
    const report = checkCsv("compliant.csv", sampleText("compliant.csv"));

    expect(report.fileType).toBe("csv");
    expect(report.summary.warn).toBe(0);
    expect(report.summary.fail).toBe(0);
    expect(report.columns).toHaveLength(20);
  });

  it("reads units past the # preamble of a protocol template", () => {
    const report = checkCsv("bottle_template.csv", sampleText("bottle_template.csv"));

    // Before the preamble was skipped this parsed as one column, "# Project ID:".
    expect(report.columns).toHaveLength(29);
    expect(unitsOf(report.columns, "DIC")).toBe("umol/kg");
    expect(unitsOf(report.columns, "Exp_ID")).toBe("not applicable");
    expect(messages(report, "pass")).toContain("11 of 20 columns declare units");
  });

  it("warns about unrecognized headers, missing QC flags, and orphan flags", () => {
    const report = checkCsv("noncompliant.csv", sampleText("noncompliant.csv"));

    expect(report.summary.fail).toBe(0);
    expect(messages(report, "warn")).toEqual([
      "6 columns not in recommended list",
      "1 variable missing QC flag columns",
      "1 QC flag column without matching variable",
      "No units declared for any column",
    ]);
  });

  it("fails a file with no detectable headers", () => {
    const report = checkCsv("empty.csv", sampleText("empty.csv"));

    expect(report.summary.fail).toBe(1);
    expect(messages(report, "fail")).toEqual(["No column headers detected"]);
    expect(report.checks).toHaveLength(1);
  });
});

describe("checkExcel", () => {
  it("reports xlsx as its own file type, not csv", async () => {
    const report = await checkExcel("compliant.xlsx", sampleBytes("compliant.xlsx"));

    expect(report.fileType).toBe("xlsx");
    expect(report.columns).toHaveLength(20);
    expect(report.summary.warn).toBe(0);
  });

  it("produces the same columns and units as the CSV it was built from", async () => {
    // Presentation is shared across formats, so the parsed shape must be too.
    const csv = checkCsv("compliant.csv", sampleText("compliant.csv"));
    const xlsx = await checkExcel("compliant.xlsx", sampleBytes("compliant.xlsx"));

    expect(xlsx.columns).toEqual(csv.columns);
    expect(messages(xlsx, "pass")).toEqual(messages(csv, "pass"));
  });
});

describe("checkNetCdf", () => {
  it("reports units from variable attributes in the same shape as a spreadsheet", async () => {
    const report = await checkNetCdf("model_output_v3.nc", sampleBytes("model_output_v3.nc"));

    expect(report.fileType).toBe("netcdf");
    expect(unitsOf(report.columns, "dic")).toBe("umol/kg");
    expect(messages(report, "pass")).toContain("11 of 11 columns declare units");
  });

  it("warns that protocol-required model variables are unrecognized", async () => {
    // The sample carries the OAE protocol's model data minimum set, yet talk,
    // fgco2, area and volume are absent from RECOMMENDED_VARIABLES. Conformant
    // model output is flagged for columns the protocol requires it to have.
    const report = await checkNetCdf("model_output_v3.nc", sampleBytes("model_output_v3.nc"));

    const unrecognized = report.checks.find((c) => c.message.includes("not in recommended list"));
    expect(unrecognized?.details).toBe("talk, fgco2, area, volume");
  });

  it("cannot read NetCDF-4, which is what most ocean models write", async () => {
    // netcdfjs is v3-classic only. NetCDF-4 is HDF5 underneath, so the parser
    // rejects it outright. Delete this test when the reader gains HDF5 support.
    await expect(
      checkNetCdf("model_output_v4.nc", sampleBytes("model_output_v4.nc")),
    ).rejects.toThrow(/should start with CDF/);
  });
});
