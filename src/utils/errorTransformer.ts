// errorTransformer.ts - Centralized form validation error transformation

import type { RJSFValidationError } from "@rjsf/utils";
import { MESSAGES } from "@/constants/messages";

/**
 * The open-access rule ("a data access link or a data access date") is a LinkML
 * `any_of` postcondition. The bundler rewrites it as nested if/then (see
 * rewriteEitherOrRules in bundle-schema.mjs), so AJV reports it as a single
 * required error for the second field, sitting under `then/then`, plus the
 * if-wrappers dropped elsewhere. That one error is fanned out to both fields
 * with the either/or wording, so neither reads as simply "required".
 */
const DATA_ACCESS_EITHER_OR_FIELDS = ["data_access_link", "data_access_date"];

function isDataAccessBranchError(e: RJSFValidationError): boolean {
  return (
    e.name === "required" &&
    // Already fanned out by an earlier pass; validateDataset and the form both
    // run this transform, and a second pass must be a no-op.
    e.message !== MESSAGES.validation.dataAccessEitherOr &&
    /\/then\/then\/required$/.test(e.schemaPath ?? "") &&
    DATA_ACCESS_EITHER_OR_FIELDS.includes(e.params?.missingProperty ?? "")
  );
}

function isDataAccessEnvelopeError(e: RJSFValidationError): boolean {
  return e.name === "anyOf" && /\/then\/anyOf$/.test(e.schemaPath ?? "");
}

/**
 * AJV reports an if/then rule twice: the concrete failure inside `then` (a
 * required property, say) and a wrapper saying the data 'must match "then"
 * schema'. The wrapper names no field and repeats nothing useful, so it is
 * dropped for every rule, not only the data-access one. The scheduled-access
 * rule was the visible case: "Field is required" on the date, plus that line.
 */
function isIfThenEnvelopeError(e: RJSFValidationError): boolean {
  return e.name === "if" && e.params?.failingKeyword === "then";
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
    .filter((e) => !isIfThenEnvelopeError(e))
    .filter((e) => !(hasDataAccessBranchError && isDataAccessEnvelopeError(e)))
    .flatMap((e) => {
      // One rule, two fields: both inputs turn red carrying one sentence
      // rather than either reading as plainly required.
      if (isDataAccessBranchError(e)) {
        return DATA_ACCESS_EITHER_OR_FIELDS.map((field) => ({
          ...e,
          property: `.${field}`,
          params: { ...e.params, missingProperty: field },
          message: MESSAGES.validation.dataAccessEitherOr,
        }));
      }
      return [e];
    })
    .map((e) => {
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
        // The either/or errors are fanned out above with their own wording and
        // must not be flattened back into a plain "required".
        const isEitherOr = e.message === MESSAGES.validation.dataAccessEitherOr;
        if (!isSpatialCov && !isExperimentId && !isEitherOr) {
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
