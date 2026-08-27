import { describe, expect, expectTypeOf, it } from "vitest";
import type { JSONSchema } from "@/components/schemaUtils";
import type { DraftVariable } from "@/types/variable";
import { parseVariable } from "@/utils/parseVariable";
import { getBaseSchema } from "@/utils/schemaViews";

const root = getBaseSchema() as unknown as JSONSchema;

describe("parseVariable", () => {
  it("strips extra and empty fields, keeps the discriminant", () => {
    const result = parseVariable(
      {
        schema_class: "DiscretePHVariable",
        long_name: "pH",
        not_a_field: "x",
        cleared: "",
      },
      root,
    );

    expect(result.schema_class).toBe("DiscretePHVariable");
    expect(result).not.toHaveProperty("not_a_field");
    expect(result).not.toHaveProperty("cleared");
  });

  it("returns a discriminated DraftVariable, not a loose record", () => {
    const result = parseVariable({ schema_class: "DiscretePHVariable" }, root);

    // The return type is the discriminated union, not Record<string, unknown>.
    expectTypeOf(result).toEqualTypeOf<DraftVariable>();

    // schema_class is the literal discriminant union, so it narrows — it is not
    // plain `string` and it is not `unknown`.
    expectTypeOf<DraftVariable["schema_class"]>().not.toEqualTypeOf<string>();
    expectTypeOf(result.schema_class).not.toBeUnknown();
  });
});

describe("parseVariable — standard_identifier", () => {
  const identifier = {
    term: "sea_water_ph_reported_on_total_scale",
    uri: "http://vocab.nerc.ac.uk/collection/P07/current/CF14N56/",
  };

  it("keeps a complete VocabularyItemReference intact", () => {
    const result = parseVariable(
      { schema_class: "DiscretePHVariable", standard_identifier: { ...identifier } },
      root,
    );

    expect(result.standard_identifier).toEqual(identifier);
  });

  it("keeps a user-written description alongside it", () => {
    const withDescription = { ...identifier, description: "pH on the total scale." };
    const result = parseVariable(
      { schema_class: "DiscretePHVariable", standard_identifier: withDescription },
      root,
    );

    expect(result.standard_identifier).toEqual(withDescription);
  });

  it("drops an empty identifier object rather than exporting it", () => {
    const result = parseVariable(
      { schema_class: "DiscretePHVariable", standard_identifier: {} },
      root,
    );

    expect(result).not.toHaveProperty("standard_identifier");
  });

  it("strips keys VocabularyItemReference does not define", () => {
    const result = parseVariable(
      {
        schema_class: "DiscretePHVariable",
        standard_identifier: { ...identifier, source: "cf-picker" },
      },
      root,
    );

    expect(result.standard_identifier).toEqual(identifier);
  });

  it("keeps it on a model output variable too", () => {
    const result = parseVariable(
      { schema_class: "ModelOutputVariable", standard_identifier: { ...identifier } },
      root,
    );

    expect(result.standard_identifier).toEqual(identifier);
  });
});
