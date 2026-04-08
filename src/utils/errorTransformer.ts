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
    // Normalize ALL "required" error messages.
    //
    // RJSF interpolates a field title into the message via a fragile
    // schemaPath/uiSchema lookup. With $ref'd nested classes that share
    // property names (e.g. multiple `name` fields across Person, Experiment,
    // Funding, Organization, etc.) the lookup can pick the wrong title
    // (showing "Experiment Name" for a Person's name field, etc.).
    //
    // The inline error appears directly under a labeled field, so the
    // message doesn't need to repeat the title. The top error list
    // (CustomErrorList) prepends a contextual path like
    // "Project Leads → 0 → Name:". A clean generic message is best for both.
    if (e.name === "required") {
      // Preserve special-case rewrites that come later in the chain
      // (experiment_id, spatial coverage) by NOT overriding them here —
      // those branches return early below.
      const isSpatialCov = isSpatialCoverageError(e);
      const isExperimentId =
        e.params?.missingProperty === "experiment_id" ||
        e.property === ".experiment_id";
      if (!isSpatialCov && !isExperimentId) {
        e = { ...e, message: "Field is required" };
      }
    }

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

    // Improve phone pattern error message
    if (e.name === "pattern" && e.property?.endsWith(".phone")) {
      return {
        ...e,
        message: "Invalid phone number"
      };
    }

    return e;
  });
}
