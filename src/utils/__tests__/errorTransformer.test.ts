// errorTransformer.test.ts - Tests for error transformation utility

import type { RJSFValidationError } from "@rjsf/utils";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/constants/messages";
import { transformFormErrors } from "../errorTransformer";

describe("transformFormErrors", () => {
  it("should transform temporal coverage pattern error", () => {
    const errors = [
      {
        property: ".temporal_coverage",
        name: "pattern",
        message: "should match pattern",
      },
    ] as RJSFValidationError[];

    const result = transformFormErrors(errors);

    expect(result[0].message).toBe(MESSAGES.validation.temporalCoveragePattern);
  });

  it("should normalize spatial coverage errors", () => {
    const testCases = [
      {
        property: ".spatial_coverage.geo.box",
        name: "required",
      },
      {
        property: ".spatial_coverage.geo",
        name: "required",
      },
      {
        property: ".spatial_coverage",
        name: "required",
      },
      {
        property: ".",
        name: "required",
        params: { missingProperty: "spatial_coverage" },
      },
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
        message: "must have required property 'project_id'",
      },
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
        message: "should match pattern",
      },
      {
        property: ".spatial_coverage",
        name: "required",
      },
      {
        property: ".project_id",
        name: "required",
      },
    ] as RJSFValidationError[];

    const result = transformFormErrors(errors);

    expect(result).toHaveLength(3);
    expect(result[0].message).toBe(MESSAGES.validation.temporalCoveragePattern);
    expect(result[1].message).toBe(MESSAGES.validation.spatialCoverage);
    // Generic required errors get normalized to "Field is required"
    expect(result[2].message).toBe("Field is required");
  });

  // The open-access rule is a LinkML any_of postcondition. AJV reports one
  // failure per branch plus a bare anyOf and if, all on the dataset object.
  describe("data access either/or rule", () => {
    // Raw AJV output for the bundler's nested if/then form of the rule: one
    // required error two `then`s deep, plus the wrappers.
    // Raw AJV output for the bundler's "not both absent" form of the rule: one
    // `not` failure on the object, plus the if-wrapper.
    const anyOfErrors = (): RJSFValidationError[] =>
      [
        {
          name: "not",
          property: "",
          message: "must NOT be valid",
          params: {},
          schemaPath: "#/allOf/1/then/not",
        },
        {
          name: "if",
          property: "",
          message: 'must match "then" schema',
          params: { failingKeyword: "then" },
          schemaPath: "#/allOf/1/if",
        },
      ] as RJSFValidationError[];

    it("fans the single raw error out to both fields", () => {
      const result = transformFormErrors(anyOfErrors());
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.property).sort()).toEqual([
        ".data_access_date",
        ".data_access_link",
      ]);
    });

    it("gives both fields the either/or message as required-class errors", () => {
      const result = transformFormErrors(anyOfErrors());
      for (const e of result) {
        expect(e.message).toBe(MESSAGES.validation.dataAccessEitherOr);
        // Required-class, so the form hides it until Validate like the others.
        expect(e.name).toBe("required");
      }
    });

    it("is idempotent, so validateDataset and the form agree", () => {
      const once = transformFormErrors(anyOfErrors());
      const twice = transformFormErrors(once);
      expect(twice).toEqual(once);
    });

    it("keeps the scheduled-access required error and drops its if/then wrapper", () => {
      const result = transformFormErrors([
        {
          name: "required",
          property: "",
          message: "must have required property 'data_access_date'",
          params: { missingProperty: "data_access_date" },
          schemaPath: "#/allOf/0/then/required",
        },
        {
          name: "if",
          property: "",
          message: 'must match "then" schema',
          params: { failingKeyword: "then" },
          schemaPath: "#/allOf/0/if",
        },
      ] as RJSFValidationError[]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("required");
      expect(result[0].message).toBe("Field is required");
    });

    it("drops the if/then wrapper for any conditional rule", () => {
      const result = transformFormErrors([
        {
          name: "required",
          property: "",
          message: "must have required property 'alkalinity_feedstock_custom'",
          params: { missingProperty: "alkalinity_feedstock_custom" },
          schemaPath: "#/allOf/0/then/required",
        },
        {
          name: "if",
          property: "",
          message: 'must match "then" schema',
          params: { failingKeyword: "then" },
          schemaPath: "#/allOf/0/if",
        },
      ] as RJSFValidationError[]);

      expect(result.map((e) => e.name)).toEqual(["required"]);
    });

    it("keeps an unrelated anyOf envelope when no data-access branch failed", () => {
      const result = transformFormErrors([
        {
          name: "anyOf",
          property: ".something_else",
          message: "must match a schema in anyOf",
          params: {},
          schemaPath: "#/allOf/3/then/anyOf",
        },
      ] as RJSFValidationError[]);

      expect(result).toHaveLength(1);
    });
  });
});
