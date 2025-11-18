// dateUtils.ts - Centralized date and time utility functions

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

// Format constants
export const DATE_FORMAT = "YYYY-MM-DD";
export const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * Parse a date string to a Date object
 * @param dateStr - Date string in any format dayjs can parse
 * @returns Date object or null if invalid
 */
export const parseToDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = dayjs(dateStr);
  return d.isValid() ? d.toDate() : null;
};

/**
 * Format a Date object to YYYY-MM-DD string
 * @param date - Date object to format
 * @returns Formatted date string or empty string if null
 */
export const formatFromDate = (date: Date | null): string => {
  if (!date) return "";
  return dayjs(date).format(DATE_FORMAT);
};

/**
 * Parse an ISO 8601 interval string (YYYY-MM-DD/YYYY-MM-DD or YYYY-MM-DD/..)
 * @param v - Interval string
 * @returns Object with start and end date strings
 */
export const parseInterval = (v?: string | null): { start: string; end: string } => {
  if (!v || typeof v !== "string") return { start: "", end: "" };
  const [start, end] = v.split("/");
  return {
    start: start || "",
    end: end && end !== ".." ? end : ""
  };
};

/**
 * Build an ISO 8601 interval string from start and end dates
 * @param start - Start date string (YYYY-MM-DD)
 * @param end - End date string (YYYY-MM-DD) or empty for open-ended
 * @returns ISO interval string or undefined if no start date
 */
export const buildInterval = (start: string, end: string): string | undefined => {
  if (!start) return undefined;
  return `${start}/${end || ".."}`;
};

/**
 * Validate a date string in YYYY-MM-DD format
 * @param input - Date string to validate
 * @returns True if valid or empty, false otherwise
 */
export const validateDate = (input: string): boolean => {
  if (!input) return true; // empty is valid
  const d = dayjs(input, DATE_FORMAT, true);
  return d.isValid();
};

/**
 * Parse an ISO 8601 datetime string to formatted datetime string
 * @param isoStr - ISO datetime string
 * @returns Formatted datetime string (YYYY-MM-DD HH:mm:ss) or empty string
 */
export const parseToDateTime = (isoStr?: string): string => {
  if (!isoStr) return "";
  const d = dayjs.utc(isoStr);
  return d.isValid() ? d.format(DATETIME_FORMAT) : "";
};

/**
 * Parse a datetime string to ISO 8601 format
 * @param dateStr - Datetime string in DATETIME_FORMAT or DATE_FORMAT
 * @returns ISO 8601 string or undefined if invalid
 */
export const parseToIso = (dateStr: string): string | undefined => {
  if (!dateStr) return undefined;

  // Try parsing as datetime first
  let d = dayjs.utc(dateStr, DATETIME_FORMAT, true);
  if (d.isValid()) {
    return d.toISOString();
  }

  // Fall back to date-only format (assumes midnight UTC)
  d = dayjs.utc(dateStr, DATE_FORMAT, true);
  if (d.isValid()) {
    return d.hour(0).minute(0).second(0).toISOString();
  }

  return undefined;
};

/**
 * Validate a datetime string
 * @param input - Datetime string to validate
 * @returns True if valid datetime or date format, or if empty
 */
export const validateDateTime = (input: string): boolean => {
  if (!input) return true; // empty is valid

  // Check datetime format
  let d = dayjs.utc(input, DATETIME_FORMAT, true);
  if (d.isValid()) return true;

  // Check date-only format
  d = dayjs.utc(input, DATE_FORMAT, true);
  return d.isValid();
};
