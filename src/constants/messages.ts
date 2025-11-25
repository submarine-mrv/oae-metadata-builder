// messages.ts - Centralized user-facing messages and text constants

export const MESSAGES = {
  validation: {
    isoInterval:
      "Use ISO interval: YYYY-MM-DD/YYYY-MM-DD or open-ended YYYY-MM-DD/..",
    spatialCoverage: "Spatial Coverage is required",
    depthInvalid: "Maximum depth must be 0 or negative (below sea surface).",
    depthOrder:
      "Minimum depth must be greater than or equal to maximum depth.",
    temporalCoverageRequired: "Start date is required.",
    temporalCoverageOrder: "End date must be ≥ start date."
  },
  errors: {
    importFailed: (error: string) => `Failed to import metadata: ${error}`,
    fileReadFailed: "Failed to read file",
    jsonParseFailed: (error: string) => `Failed to parse JSON file: ${error}`,
    mapLoadFailed: "Failed to load map library"
  }
};
