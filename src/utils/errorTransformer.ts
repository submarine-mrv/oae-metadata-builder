// errorTransformer.ts - Centralized form validation error transformation

import type { RJSFValidationError } from "@rjsf/utils";
import { MESSAGES } from "@/constants/messages";

/**
 * The open-access rule ("a data access link or a data access date") is a LinkML
 * `any_of` postcondition, so AJV reports one failure per branch plus a bare
 * `anyOf` and `if` error — four errors on the dataset object, none attached to a
 * field. Left alone that reads as "both are required", which is the opposite of
 * the rule.
 *
 * These two predicates split those errors into the ones worth re-pointing at a
 * field and the ones with no field and no usable message.
 */
const DATA_ACCESS_EITHER_OR_FIELDS = ["data_access_link", "data_access_date"];

function isDataAccessBranchError(e: RJSFValidationError): boolean {
  return (
    e.name === "required" &&
    /\/then\/anyOf\/\d+\/required$/.test(e.schemaPath ?? "") &&
    DATA_ACCESS_EITHER_OR_FIELDS.includes(e.params?.missingProperty ?? "")
  );
}

/**
 * True for an error already rewritten by the either/or transform. Callers that
 * hide generic "required" noise use this to keep these, since they carry a
 * specific instruction rather than a missing-value complaint.
 */
export function isDataAccessEitherOrError(e: RJSFValidationError): boolean {
  return e.message === MESSAGES.validation.dataAccessEitherOr;
}

function isDataAccessEnvelopeError(e: RJSFValidationError): boolean {
  if (e.name === "anyOf") return /\/then\/anyOf$/.test(e.schemaPath ?? "");
  // The `if` wrapper around the same rule carries no field and no message worth
  // showing; the branch errors already say what to do.
  return (
    e.name === "if" &&
    e.params?.failingKeyword === "then" &&
    (e.schemaPath ?? "").includes("/allOf/")
  );
}

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
export function transformFormErrors(errors: RJSFValidationError[]): RJSFValidationError[] {
  // Drop the anyOf/if envelope around the data-access rule. Its branch errors
  // are retargeted onto the two fields below and carry the whole message.
  const hasDataAccessBranchError = errors.some(isDataAccessBranchError);

  return errors
    .filter((e) => !(hasDataAccessBranchError && isDataAccessEnvelopeError(e)))
    .map((e) => {
      // Point each branch of the either/or rule at the field it names, so both
      // inputs turn red carrying one sentence rather than two "is required" ones.
      if (isDataAccessBranchError(e)) {
        return {
          ...e,
          property: `.${e.params?.missingProperty}`,
          message: MESSAGES.validation.dataAccessEitherOr,
        };
      }

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
          e.params?.missingProperty === "experiment_id" || e.property === ".experiment_id";
        if (!isSpatialCov && !isExperimentId) {
          e = { ...e, message: "Field is required" };
        }
      }

      // Improve temporal coverage pattern error message
      if (e.property === ".temporal_coverage" && e.name === "pattern") {
        return {
          ...e,
          message: MESSAGES.validation.temporalCoveragePattern,
        };
      }

      // Normalize and improve spatial coverage error messages
      if (isSpatialCoverageError(e)) {
        return {
          ...e,
          property: ".spatial_coverage", // Normalize to spatial_coverage level
          message: MESSAGES.validation.spatialCoverage,
        };
      }

      // Improve experiment_id required error message
      if (
        e.name === "required" &&
        (e.params?.missingProperty === "experiment_id" || e.property === ".experiment_id")
      ) {
        return {
          ...e,
          message: MESSAGES.validation.experimentIdRequired,
        };
      }

      // Improve email pattern error message
      if (e.name === "pattern" && e.message?.includes("@[a-zA-Z0-9.-]+")) {
        return {
          ...e,
          message: "Please enter a valid email address",
        };
      }

      // Improve data access link URL pattern error message
      if (e.name === "pattern" && e.property?.endsWith(".data_access_link")) {
        return {
          ...e,
          message: "Must be a valid URL starting with http:// or https://",
        };
      }

      // Improve phone pattern error message
      if (e.name === "pattern" && e.property?.endsWith(".phone")) {
        return {
          ...e,
          message: "Invalid phone number",
        };
      }

      return e;
    });
}
