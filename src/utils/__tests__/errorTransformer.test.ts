// errorTransformer.test.ts - Tests for error transformation utility

import { describe, it, expect } from "vitest";
import { transformFormErrors } from "../errorTransformer";
import { MESSAGES } from "@/constants/messages";
import type { RJSFValidationError } from "@rjsf/utils";

describe("transformFormErrors", () => {
  it("should transform temporal coverage pattern error", () => {
    const errors = [
      {
        property: ".temporal_coverage",
        name: "pattern",
        message: "should match pattern"
      }
    ] as RJSFValidationError[];

    const result = transformFormErrors(errors);

    expect(result[0].message).toBe(MESSAGES.validation.temporalCoveragePattern);
  });

  it("should normalize spatial coverage errors", () => {
    const testCases = [
      {
        property: ".spatial_coverage.geo.box",
        name: "required"
      },
      {
        property: ".spatial_coverage.geo",
        name: "required"
      },
      {
        property: ".spatial_coverage",
        name: "required"
      },
      {
        property: ".",
        name: "required",
        params: { missingProperty: "spatial_coverage" }
      }
    ];

    testCases.forEach((error) => {
      const result = transformFormErrors([error as RJSFValidationError]);
      expect(result[0].property).toBe(".spatial_coverage");
      expect(result[0].message).toBe(MESSAGES.validation.spatialCoverage);
    });
  });

  it("should normalize generic required errors to 'Field is required'", () => {
    // RJSF's title interpolation for required errors is unreliable with
    // $ref'd nested classes that share property names. We normalize all
    // required errors to a generic clean message; the field label or
    // top-list path provides context.
    const errors = [
      {
        property: ".project_id",
        name: "required",
        message: "must have required property 'project_id'"
      }
    ] as RJSFValidationError[];

    const result = transformFormErrors(errors);

    expect(result[0].message).toBe("Field is required");
    expect(result[0].name).toBe("required");
    expect(result[0].property).toBe(".project_id");
  });

  it("should handle empty error array", () => {
    const result = transformFormErrors([]);
    expect(result).toEqual([]);
  });

  it("should transform multiple errors", () => {
    const errors = [
      {
        property: ".temporal_coverage",
        name: "pattern",
        message: "should match pattern"
      },
      {
        property: ".spatial_coverage",
        name: "required"
      },
      {
        property: ".project_id",
        name: "required"
      }
    ] as RJSFValidationError[];

    const result = transformFormErrors(errors);

    expect(result).toHaveLength(3);
    expect(result[0].message).toBe(MESSAGES.validation.temporalCoveragePattern);
    expect(result[1].message).toBe(MESSAGES.validation.spatialCoverage);
    // Generic required errors get normalized to "Field is required"
    expect(result[2].message).toBe("Field is required");
  });
});
