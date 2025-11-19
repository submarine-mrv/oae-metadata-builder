// errorTransformer.ts - Centralized form validation error transformation

/**
 * Check if an error is related to spatial coverage field
 * @param e - Error object from RJSF validation
 * @returns True if error is spatial coverage related
 */
function isSpatialCoverageError(e: any): boolean {
  return (
    (e.property === ".spatial_coverage.geo.box" && e.name === "required") ||
    (e.property === ".spatial_coverage.geo" && e.name === "required") ||
    (e.property === ".spatial_coverage" && e.name === "required") ||
    (e.property === "." &&
      e.name === "required" &&
      e.params?.missingProperty === "spatial_coverage")
  );
}

/**
 * Transform RJSF validation errors to provide better user-facing messages
 * @param errors - Array of validation errors from RJSF
 * @returns Transformed errors with improved messaging
 */
export function transformFormErrors(errors: any[]): any[] {
  return errors.map((e) => {
    // Improve temporal coverage pattern error message
    if (e.property === ".temporal_coverage" && e.name === "pattern") {
      return {
        ...e,
        message:
          "Use ISO interval: YYYY-MM-DD/YYYY-MM-DD or open-ended YYYY-MM-DD/.."
      };
    }

    // Normalize and improve spatial coverage error messages
    if (isSpatialCoverageError(e)) {
      return {
        ...e,
        property: ".spatial_coverage", // Normalize to spatial_coverage level
        message: "Spatial Coverage is required"
      };
    }

    return e;
  });
}
