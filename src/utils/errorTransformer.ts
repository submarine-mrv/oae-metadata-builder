// errorTransformer.ts - Centralized form validation error transformation

import type { RJSFValidationError } from "@rjsf/utils";
import { MESSAGES } from "@/constants/messages";

/**
 * "At least one of A, B" rules arrive from the bundler as
 * `then: { not: { properties: { A: false, B: false } } }` (see
 * rewriteEitherOrRules in bundle-schema.mjs), and AJV reports a failure as one
 * `not` error on the object with no field attached. The field pair is read
 * back out of the schema at the error's own schemaPath, so the transform fans
 * the error out to exactly the fields that rule names and nothing else.
 */
const EITHER_OR_PATH = /\/then\/not$/;

function resolveSchemaPath(schema: unknown, schemaPath: string): unknown {
  if (!schema || !schemaPath.startsWith("#")) return undefined;
  let node: unknown = schema;
  for (const raw of schemaPath.slice(1).split("/").filter(Boolean)) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** An either/or `not` error resolved against the schema, or null if it is not one. */
function eitherOrRuleFor(
  e: RJSFValidationError,
  schema: unknown,
): { fields: string[]; message: string } | null {
  if (e.name !== "not" || !EITHER_OR_PATH.test(e.schemaPath ?? "")) return null;
  const node = resolveSchemaPath(schema, e.schemaPath ?? "") as
    | { properties?: Record<string, unknown> }
    | undefined;
  const fields = Object.keys(node?.properties ?? {});
  if (fields.length !== 2) return null;

  // The data-access pair has its own wording; any other pair gets one built
  // from the field titles, falling back to the property names.
  const isDataAccess = fields.includes("data_access_link") && fields.includes("data_access_date");
  const titles = (schema as { properties?: Record<string, { title?: string }> })?.properties;
  const titleOf = (f: string) => titles?.[f]?.title ?? f;
  const message = isDataAccess
    ? MESSAGES.validation.dataAccessEitherOr
    : `Either ${titleOf(fields[0])} or ${titleOf(fields[1])} must be provided.`;
  return { fields, message };
}

/** Errors produced by the fan-out below carry this marker so a second pass leaves them alone. */
const EITHER_OR_MARKER = "eitherOr";
const isEitherOrError = (e: RJSFValidationError) =>
  (e.params as Record<string, unknown> | undefined)?.[EITHER_OR_MARKER] === true;

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
export function transformFormErrors(
  errors: RJSFValidationError[],
  schema?: unknown,
): RJSFValidationError[] {
  return errors
    .filter((e) => !isIfThenEnvelopeError(e))
    .flatMap((e) => {
      // One rule, two fields: both inputs turn red carrying one sentence
      // rather than either reading as plainly required. Required-class, so
      // the form hides it until Validate like the others.
      const rule = eitherOrRuleFor(e, schema);
      if (rule) {
        return rule.fields.map((field) => ({
          ...e,
          name: "required",
          property: `.${field}`,
          params: { ...e.params, missingProperty: field, [EITHER_OR_MARKER]: true },
          message: rule.message,
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
        if (!isSpatialCov && !isExperimentId && !isEitherOrError(e)) {
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
