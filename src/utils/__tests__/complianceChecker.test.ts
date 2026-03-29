import { describe, it, expect } from "vitest";
import {
  parseCsvHeaders,
  RECOMMENDED_VARIABLES,
} from "../complianceChecker";

// We can't easily test runComplianceChecks because it needs File objects,
// but we can test the pure utility functions and the recommended list.

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
