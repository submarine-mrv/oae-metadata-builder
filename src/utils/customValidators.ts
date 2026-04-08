/**
 * Custom (cross-field) validators that aren't expressible in JSON Schema.
 *
 * These functions are passed to RJSF's `customValidate` prop AND consumed
 * by the page-level `validateProject` / `validateExperiment` calls so that
 * the badge state and the form's inline error display use the same source
 * of truth. Without that wiring the badge could show "Validated" while
 * a custom rule (e.g., depth ordering) is still failing.
 *
 * Each validator follows RJSF's `customValidate(data, errors) => errors`
 * shape so it can be reused unchanged in both call sites.
 */

import type { CustomValidator } from "@rjsf/utils";

/**
 * Validate temporal_coverage end >= start. Used by the project page.
 *
 * The schema enforces presence and ISO interval format; this only adds
 * the cross-field ordering check.
 */
export const validateTemporalCoverageOrder: CustomValidator<any> = (data, errors) => {
  const t = data?.temporal_coverage as string | undefined;
  if (!t) return errors;

  const [start, end] = t.split("/");
  if (!start || !end || end === "..") return errors;

  const s = +new Date(start);
  const e = +new Date(end);
  if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
    errors?.temporal_coverage?.addError("End date must be ≥ start date.");
  }
  return errors;
};

/**
 * Validate vertical_coverage min/max depth and height ordering.
 * Used by both the project page and the experiment page.
 *
 * Rules:
 * - max_depth must be 0 or negative (below sea surface)
 * - min_depth must be >= max_depth (less negative or equal)
 * - min_height must be <= max_height
 */
export const validateVerticalCoverage: CustomValidator<any> = (data, errors) => {
  const vc = data?.vertical_coverage;
  if (!vc) return errors;

  const minDepth = vc.min_depth_in_m;
  const maxDepth = vc.max_depth_in_m;

  if (typeof maxDepth === "number" && maxDepth > 0) {
    errors?.vertical_coverage?.max_depth_in_m?.addError(
      "Maximum depth must be 0 or negative (below sea surface)."
    );
  }

  if (
    typeof minDepth === "number" &&
    typeof maxDepth === "number" &&
    minDepth < maxDepth
  ) {
    errors?.vertical_coverage?.min_depth_in_m?.addError(
      "Minimum depth must be greater than or equal to maximum depth."
    );
  }

  const minHeight = vc.min_height_in_m;
  const maxHeight = vc.max_height_in_m;
  if (
    typeof minHeight === "number" &&
    typeof maxHeight === "number" &&
    minHeight > maxHeight
  ) {
    errors?.vertical_coverage?.min_height_in_m?.addError(
      "Minimum height must be less than or equal to maximum height."
    );
  }

  return errors;
};

/**
 * Compose multiple custom validators into a single function.
 * Each validator runs in order and may add its own errors.
 */
export function composeValidators(
  ...validators: Array<CustomValidator<any>>
): CustomValidator<any> {
  return (data, errors, uiSchema) => {
    for (const v of validators) {
      v(data, errors, uiSchema);
    }
    return errors;
  };
}

/**
 * The full custom validator for project forms.
 */
export const projectCustomValidate = composeValidators(
  validateTemporalCoverageOrder,
  validateVerticalCoverage
);

/**
 * The full custom validator for experiment forms.
 */
export const experimentCustomValidate = composeValidators(
  validateVerticalCoverage
);
