import Ajv2019 from "ajv/dist/2019";
import { describe, expect, it } from "vitest";
import type { JSONSchema } from "@/components/schemaUtils";
import bundled from "@/schema/schema.bundled.json";

/**
 * Verifies the discriminated `variables` union (oneOf + discriminator on
 * schema_class) behaves correctly under Ajv:
 *   (a) Ajv compiles the 18 $ref branches with single-value `enum` discriminator tags,
 *   (b) validation routes to the matching branch by schema_class,
 *   (c) errors are branch-targeted, not an 18-way oneOf error wall.
 */

// `discriminator` is an Ajv/OpenAPI extension absent from the standard JSONSchema
// type (its standards-track replacement is `propertyDependencies`; see
// scripts/bundle-schema.mjs), so extend it locally for these helpers.
type DiscriminatedSchema = JSONSchema & {
  $schema?: string;
  discriminator?: { propertyName: string };
};

const schema = bundled as JSONSchema;

function variablesItems(): DiscriminatedSchema {
  const items = schema.$defs?.FieldDataset?.properties?.variables?.items;
  if (!items) throw new Error("FieldDataset.variables.items missing from bundled schema");
  return items as DiscriminatedSchema;
}

function rootDefs(): Record<string, JSONSchema> {
  return schema.$defs ?? {};
}

// The bundled union is already discriminated by the bundler.
function discriminatedSchema(): DiscriminatedSchema {
  const items = variablesItems();
  return {
    $schema: "https://json-schema.org/draft/2019-09/schema",
    oneOf: items.oneOf,
    discriminator: items.discriminator,
    $defs: rootDefs(),
  };
}

// Reconstruct the bare anyOf (the pre-discriminator form) for contrast.
function plainAnyOfSchema(): DiscriminatedSchema {
  return {
    $schema: "https://json-schema.org/draft/2019-09/schema",
    anyOf: variablesItems().oneOf,
    $defs: rootDefs(),
  };
}

describe("variables discriminator", () => {
  it("the bundled variables union is a discriminated oneOf on schema_class", () => {
    const items = variablesItems();
    expect(items.anyOf).toBeUndefined();
    expect(Array.isArray(items.oneOf)).toBe(true);
    expect(items.oneOf?.length ?? 0).toBeGreaterThan(1);
    expect(items.discriminator).toEqual({ propertyName: "schema_class" });
  });

  it("Ajv compiles oneOf+discriminator (accepts single-value enum tags on $ref branches)", () => {
    const ajv = new Ajv2019({ discriminator: true, strict: false });
    expect(() => ajv.compile(discriminatedSchema())).not.toThrow();
  });

  it("routes by schema_class to the matching branch, reporting only that branch's errors", () => {
    // Ajv reports $ref-branch errors with a RELATIVE schemaPath (#/required),
    // so branch identity lives in params.missingProperty, not schemaPath.
    const ajv = new Ajv2019({ discriminator: true, strict: false, allErrors: true });
    const validate = ajv.compile(discriminatedSchema());

    const ok = validate({ schema_class: "DiscretePHVariable" });
    expect(ok).toBe(false);

    const errors = validate.errors ?? [];
    // Routed to DiscretePHVariable: its pH-specific required fields are flagged missing.
    const missing = errors
      .filter((e) => e.keyword === "required")
      .map((e) => (e.params as { missingProperty?: string }).missingProperty);
    expect(missing).toContain("measurement_temperature");
    expect(missing).toContain("ph_reported_temperature");

    // Clean: the discriminator validated ONE branch — no oneOf/anyOf error wall.
    const wrappers = errors.map((e) => e.keyword).filter((k) => k === "oneOf" || k === "anyOf");
    expect(wrappers).toHaveLength(0);
  });

  it("rejects an unknown schema_class via the discriminator", () => {
    const ajv = new Ajv2019({ discriminator: true, strict: false });
    const validate = ajv.compile(discriminatedSchema());
    const ok = validate({ schema_class: "NotARealVariableClass" });
    expect(ok).toBe(false);
    const keywords = (validate.errors ?? []).map((e) => e.keyword);
    expect(keywords).toContain("discriminator");
  });

  it("contrast: the bare anyOf produces an anyOf error wall for the same input", () => {
    const ajv = new Ajv2019({ strict: false, allErrors: true });
    const validate = ajv.compile(plainAnyOfSchema());
    validate({ schema_class: "DiscretePHVariable" });
    const errors = validate.errors ?? [];
    // The unkeyed anyOf can't tell which branch was intended — it emits a
    // top-level anyOf failure (exactly the noise the discriminator removes).
    expect(errors.some((e) => e.keyword === "anyOf")).toBe(true);
  });
});
