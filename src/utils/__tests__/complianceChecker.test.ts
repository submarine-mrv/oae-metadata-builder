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
  unitsLabel,
} from "../complianceChecker";
import { findRecommendedColumn } from "../dataFileTemplates";

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

describe("recommended columns", () => {
  it("uses the protocol templates as the source of recommended names", () => {
    // The names come from the templates, not a hand-kept list, so protocol
    // spellings like TEMP_ITS90 are recognized and invented ones are not.
    expect(findRecommendedColumn("TEMP_ITS90")).toBeDefined();
    expect(findRecommendedColumn("temp_its90")).toBeDefined();
    expect(findRecommendedColumn("revelle_factor")).toBeUndefined();
  });

  it("derives expectQcFlag from the template pairing", () => {
    expect(findRecommendedColumn("DIC")?.expectQcFlag).toBe(true);
    expect(findRecommendedColumn("Latitude")?.expectQcFlag).toBe(false);
  });

  it("records which templates each name came from", () => {
    expect(findRecommendedColumn("Exp_ID")?.templates).toHaveLength(4);
    expect(findRecommendedColumn("Niskin_ID")?.templates).toEqual(["bottle"]);
  });

  it("excludes QC flag columns from the recommended set", () => {
    expect(findRecommendedColumn("TEMP_flag")).toBeUndefined();
  });
});

describe("comment rows and the units row", () => {
  it("skips # and blank rows wherever they appear, not just at the top", () => {
    const parsed = parseDelimitedColumns(
      [
        "# Project ID: X",
        "",
        "# Template version: 1.0.1",
        "depth,temperature",
        "",
        "# a stray note between the header and the units",
        "m,deg_C",
        "5.0,13.4",
      ].join("\n"),
    );

    expect(parsed.unitsRow.kind).toBe("ok");
    expect(unitsOf(parsed.columns, "depth")).toBe("m");
    expect(unitsOf(parsed.columns, "temperature")).toBe("deg_C");
  });

  it("handles the comment shapes the templates actually use", () => {
    // A quoted comment containing commas, and the bare "#" row that sits
    // immediately above the header in bottle.xlsx.
    const parsed = parseDelimitedColumns(
      [
        '"# Flag scheme: 0 = interpolated, 2 = acceptable"',
        "#",
        "depth,temperature",
        "m,deg_C",
        "5.0,13.4",
      ].join("\n"),
    );

    expect(parsed.columns.map((c) => c.name)).toEqual(["depth", "temperature"]);
    expect(unitsOf(parsed.columns, "temperature")).toBe("deg_C");
  });

  it("only treats # as a comment in the first column", () => {
    const parsed = parseDelimitedColumns("depth,# not a comment\nm,n.a.\n5.0,x");

    expect(parsed.columns.map((c) => c.name)).toEqual(["depth", "# not a comment"]);
  });

  it("treats n.a. spellings as not applicable rather than a unit", () => {
    const parsed = parseDelimitedColumns("a,b,c,d\nn.a.,N/A,none,-\n1,2,3,4");

    expect(parsed.columns.map((c) => c.units.kind)).toEqual(Array(4).fill("not-applicable"));
  });

  it("keeps units aligned with headers when a units cell is blank", () => {
    const parsed = parseDelimitedColumns("a,b,c\nm,,umol/kg\n1,2,3");

    expect(parsed.columns.map((c) => unitsLabel(c.units))).toEqual([
      "m",
      "not declared",
      "umol/kg",
    ]);
  });
});

describe("units row validation", () => {
  it("fails when the row below the header holds numbers", () => {
    // No unit is a bare number, so this row is the first data record and the
    // file has no units row at all.
    const report = checkCsv("x.csv", "depth,temperature\n5.0,13.4\n25.0,12.1");

    expect(report.summary.fail).toBe(1);
    expect(messages(report, "fail")).toEqual(["Units row contains 2 numeric values"]);
  });

  it("names the offending columns and values", () => {
    const report = checkCsv("x.csv", "depth,temperature\n5.0,deg_C\n25.0,12.1");

    const failure = report.checks.find((c) => c.severity === "fail");
    expect(failure?.details).toContain("depth = 5.0");
  });

  it("does not label columns with values taken from a data row", () => {
    const report = checkCsv("x.csv", "sample_id,depth\nOAE-001,5.0\nOAE-002,25.0");

    expect(report.columns.map((c) => c.units.kind)).toEqual(["missing", "missing"]);
  });

  it("fails when there is nothing below the header at all", () => {
    const report = checkCsv("x.csv", "depth,temperature");

    expect(messages(report, "fail")).toEqual(["No units row"]);
  });
});

describe("checkCsv", () => {
  it("passes a fully compliant file with no warnings", () => {
    const report = checkCsv("compliant.csv", sampleText("compliant.csv"));

    expect(report.fileType).toBe("csv");
    expect(report.summary.warn).toBe(0);
    expect(report.summary.fail).toBe(0);
    expect(report.columns).toHaveLength(18);
  });

  it("reads units past the # preamble of a protocol template", () => {
    const report = checkCsv("bottle_template.csv", sampleText("bottle_template.csv"));

    // Before the preamble was skipped this parsed as one column, "# Project ID:".
    expect(report.columns).toHaveLength(29);
    expect(unitsOf(report.columns, "DIC")).toBe("umol/kg");
    expect(unitsOf(report.columns, "Exp_ID")).toBe("not applicable");
    expect(messages(report, "pass")).toContain("11 of 20 columns declare units");
    expect(report.summary.warn).toBe(0);
  });

  it("warns about unrecognized headers, missing QC flags, and orphan flags", () => {
    const report = checkCsv("noncompliant.csv", sampleText("noncompliant.csv"));

    expect(messages(report, "warn")).toEqual([
      "6 columns not in recommended list",
      "1 QC flag column without matching variable",
    ]);
    // It also has no units row, which the protocol requires.
    expect(report.summary.fail).toBe(1);
  });

  it("fails a file with no detectable headers", () => {
    const report = checkCsv("empty.csv", sampleText("empty.csv"));

    expect(report.summary.fail).toBe(1);
    expect(messages(report, "fail")).toEqual(["No column headers detected"]);
    expect(report.checks).toHaveLength(1);
  });
});

describe("QC flag pairing", () => {
  // The templates suffix the variable but not the flag, so exact matching alone
  // reported these correctly-paired columns as orphans.
  const pairs = [
    ["TEMP_ITS90", "TEMP_flag"],
    ["Salinity_PSS78", "Salinity_flag"],
    ["fCO2_SW_SST", "fCO2_SW_flag"],
    ["doxy", "doxygen_flag"],
  ];

  it.each(pairs)("pairs %s with %s", (variable, flag) => {
    const report = checkCsv("x.csv", `${variable},${flag}\nn.a.,n.a.\n1,2`);

    expect(messages(report, "warn")).not.toContain("1 QC flag column without matching variable");
  });

  it("gives each flag to its most specific variable", () => {
    // SAL_ is a prefix of Salinity_, so the shorter base must not win.
    const report = checkCsv(
      "x.csv",
      "SAL_PSS78,SAL_flag,Salinity_PSS78,Salinity_flag\nn.a.,n.a.,n.a.,n.a.\n1,2,3,4",
    );

    expect(report.checks.some((c) => c.message.includes("without matching variable"))).toBe(false);
  });

  it("still reports a genuinely orphaned flag", () => {
    const report = checkCsv("x.csv", "depth,oxygen_flag\nm,n.a.\n1,2");

    expect(messages(report, "warn")).toContain("1 QC flag column without matching variable");
  });
});

describe("stray note above the header", () => {
  it("fails rather than treating the note as the header row", () => {
    // physiological.xlsx puts "(example response variables)" between the
    // preamble and the header, with no "#". Users are expected to delete it.
    const report = checkCsv(
      "physiological.csv",
      [
        "# Notes: For pH, T stands for total scale.",
        ",,,,,,(example response variables),,,,",
        "Exp_ID,Measurement_ID,Temperature_ITS90,DIC",
        "n.a.,n.a.,deg_C,umol/kg",
        "1,2,25.7,2037.6",
      ].join("\n"),
    );

    expect(report.summary.fail).toBe(1);
    expect(messages(report, "fail")).toEqual(["Unexpected row above the column headers"]);
    expect(report.checks[0].details).toContain("(example response variables)");
  });
});

describe("template selection", () => {
  const bottle = [
    "Exp_ID,Cruise_ID,Station_ID,Latitude",
    "n.a.,n.a.,n.a.,decimal degrees",
    "1,2,3,4",
  ].join("\n");

  it("auto-detects the template and checks against it", () => {
    const report = checkCsv("x.csv", bottle);

    expect(report.template?.id).toBe("bottle");
    expect(messages(report, "pass")).toContain("4 of 54 Bottle template columns present");
  });

  it("honours an explicit template over detection", () => {
    const report = checkCsv("x.csv", bottle, "physiological");

    expect(report.template?.id).toBe("physiological");
  });

  it("falls back to the generic recommended list when told it is not a template", () => {
    const report = checkCsv("x.csv", bottle, "none");

    expect(report.template).toBeUndefined();
    expect(report.checks.some((c) => c.message.includes("template"))).toBe(false);
  });

  it("does not apply a template to NetCDF, which has no template layout", async () => {
    const report = await checkNetCdf("model_output_v3.nc", sampleBytes("model_output_v3.nc"));

    expect(report.template).toBeUndefined();
  });
});

describe("checkExcel", () => {
  it("reports xlsx as its own file type, not csv", async () => {
    const report = await checkExcel("compliant.xlsx", sampleBytes("compliant.xlsx"));

    expect(report.fileType).toBe("xlsx");
    expect(report.columns).toHaveLength(18);
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

  it("does not judge NetCDF variable names against the spreadsheet templates", async () => {
    // Recommended names come from the templates, which are spreadsheet layouts.
    // The protocol's Model Output Variables table is not published machine
    // readably, so guessing names here would repeat the mistake we removed.
    const report = await checkNetCdf("model_output_v3.nc", sampleBytes("model_output_v3.nc"));

    expect(messages(report, "warn")).toEqual(["Variable names not checked"]);
    expect(report.checks.some((c) => c.message.includes("QC flag"))).toBe(false);
  });

  it("cannot read NetCDF-4, which is what most ocean models write", async () => {
    // netcdfjs is v3-classic only. NetCDF-4 is HDF5 underneath, so the parser
    // rejects it outright. Delete this test when the reader gains HDF5 support.
    await expect(
      checkNetCdf("model_output_v4.nc", sampleBytes("model_output_v4.nc")),
    ).rejects.toThrow(/should start with CDF/);
  });
});
