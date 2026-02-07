// errorTransformer.test.ts - Tests for error transformation utility

import { describe, it, expect } from "vitest";
import { transformFormErrors } from "../errorTransformer";
import { MESSAGES } from "@/constants/messages";

describe("transformFormErrors", () => {
  it("should transform temporal coverage pattern error", () => {
    const errors = [
      {
        property: ".temporal_coverage",
        name: "pattern",
        message: "should match pattern"
      }
    ];

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
      const result = transformFormErrors([error]);
      expect(result[0].property).toBe(".spatial_coverage");
      expect(result[0].message).toBe(MESSAGES.validation.spatialCoverage);
    });
  });

  it("should not transform unrelated errors", () => {
    const errors = [
      {
        property: ".project_id",
        name: "required",
        message: "is a required property"
      }
    ];

    const result = transformFormErrors(errors);

    expect(result[0]).toEqual(errors[0]);
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
    ];

    const result = transformFormErrors(errors);

    expect(result).toHaveLength(3);
    expect(result[0].message).toBe(MESSAGES.validation.temporalCoveragePattern);
    expect(result[1].message).toBe(MESSAGES.validation.spatialCoverage);
    expect(result[2]).toEqual(errors[2]);
  });
});
