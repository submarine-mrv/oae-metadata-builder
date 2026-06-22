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
