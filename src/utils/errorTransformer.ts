// errorTransformer.ts - Centralized form validation error transformation

import type { RJSFValidationError } from "@rjsf/utils";
import { MESSAGES } from "@/constants/messages";

/**
 * Check if an error is related to spatial coverage field
 * @param e - Error object from RJSF validation
 * @returns True if error is spatial coverage related
 */
function isSpatialCoverageError(e: RJSFValidationError): boolean {
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
export function transformFormErrors(
  errors: RJSFValidationError[]
): RJSFValidationError[] {
  return errors.map((e) => {
    // Improve temporal coverage pattern error message
    if (e.property === ".temporal_coverage" && e.name === "pattern") {
      return {
        ...e,
        message: MESSAGES.validation.temporalCoveragePattern
      };
    }

    // Normalize and improve spatial coverage error messages
    if (isSpatialCoverageError(e)) {
      return {
        ...e,
        property: ".spatial_coverage", // Normalize to spatial_coverage level
        message: MESSAGES.validation.spatialCoverage
      };
    }

    // Improve experiment_id required error message
    if (
      e.name === "required" &&
      (e.params?.missingProperty === "experiment_id" ||
        e.property === ".experiment_id")
    ) {
      return {
        ...e,
        message: MESSAGES.validation.experimentIdRequired
      };
    }

    // Improve email pattern error message
    if (e.name === "pattern" && e.message?.includes("@[a-zA-Z0-9.-]+")) {
      return {
        ...e,
        message: "Please enter a valid email address"
      };
    }

    return e;
  });
}
