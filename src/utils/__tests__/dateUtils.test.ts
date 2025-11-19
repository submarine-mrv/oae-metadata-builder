// dateUtils.test.ts - Tests for date utility functions

import { describe, it, expect } from "vitest";
import {
  parseToDate,
  formatFromDate,
  parseInterval,
  buildInterval,
  validateDate,
  parseToDateTime,
  parseToIso,
  validateDateTime,
  DATE_FORMAT,
  DATETIME_FORMAT
} from "../dateUtils";

describe("dateUtils", () => {
  describe("parseToDate", () => {
    it("should parse valid date string to Date object", () => {
      const result = parseToDate("2024-01-15");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it("should return null for invalid date", () => {
      expect(parseToDate("invalid")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseToDate("")).toBeNull();
    });
  });

  describe("formatFromDate", () => {
    it("should format Date to YYYY-MM-DD", () => {
      const date = new Date(2024, 0, 15); // Month is 0-indexed
      const result = formatFromDate(date);
      expect(result).toMatch(/^2024-01-15$/);
    });

    it("should return empty string for null", () => {
      expect(formatFromDate(null)).toBe("");
    });
  });

  describe("parseInterval", () => {
    it("should parse valid interval string", () => {
      const result = parseInterval("2024-01-01/2024-12-31");
      expect(result).toEqual({ start: "2024-01-01", end: "2024-12-31" });
    });

    it("should handle open-ended interval", () => {
      const result = parseInterval("2024-01-01/..");
      expect(result).toEqual({ start: "2024-01-01", end: "" });
    });

    it("should return empty strings for null", () => {
      const result = parseInterval(null);
      expect(result).toEqual({ start: "", end: "" });
    });
  });

  describe("buildInterval", () => {
    it("should build interval from dates", () => {
      const result = buildInterval("2024-01-01", "2024-12-31");
      expect(result).toBe("2024-01-01/2024-12-31");
    });

    it("should build open-ended interval when end is empty", () => {
      const result = buildInterval("2024-01-01", "");
      expect(result).toBe("2024-01-01/..");
    });

    it("should return undefined when start is empty", () => {
      const result = buildInterval("", "2024-12-31");
      expect(result).toBeUndefined();
    });
  });

  describe("validateDate", () => {
    it("should validate correct date format", () => {
      expect(validateDate("2024-01-15")).toBe(true);
    });

    it("should reject invalid date format", () => {
      expect(validateDate("01/15/2024")).toBe(false);
      expect(validateDate("invalid")).toBe(false);
    });

    it("should accept empty string", () => {
      expect(validateDate("")).toBe(true);
    });
  });

  describe("parseToDateTime", () => {
    it("should parse ISO datetime to formatted string", () => {
      const result = parseToDateTime("2024-01-15T10:30:00Z");
      expect(result).toMatch(/^2024-01-15 \d{2}:\d{2}:\d{2}$/);
    });

    it("should return empty string for invalid input", () => {
      expect(parseToDateTime("invalid")).toBe("");
      expect(parseToDateTime()).toBe("");
    });
  });

  describe("parseToIso", () => {
    it("should parse datetime string to ISO", () => {
      const result = parseToIso("2024-01-15 10:30:00");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should parse date-only string to ISO (midnight)", () => {
      const result = parseToIso("2024-01-15");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00/);
    });

    it("should return undefined for invalid input", () => {
      expect(parseToIso("invalid")).toBeUndefined();
      expect(parseToIso("")).toBeUndefined();
    });
  });

  describe("validateDateTime", () => {
    it("should validate datetime format", () => {
      expect(validateDateTime("2024-01-15 10:30:00")).toBe(true);
    });

    it("should validate date-only format", () => {
      expect(validateDateTime("2024-01-15")).toBe(true);
    });

    it("should reject invalid format", () => {
      expect(validateDateTime("01/15/2024 10:30")).toBe(false);
      expect(validateDateTime("invalid")).toBe(false);
    });

    it("should accept empty string", () => {
      expect(validateDateTime("")).toBe(true);
    });
  });

  describe("constants", () => {
    it("should export DATE_FORMAT constant", () => {
      expect(DATE_FORMAT).toBe("YYYY-MM-DD");
    });

    it("should export DATETIME_FORMAT constant", () => {
      expect(DATETIME_FORMAT).toBe("YYYY-MM-DD HH:mm:ss");
    });
  });
});
