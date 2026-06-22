import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { JSONSchema } from "@/components/schemaUtils";
import {
  normalizeVariableFields,
  stripExtraVariableFields,
} from "@/components/VariableModal/variableModalConfig";
import { cleanVariableData } from "@/utils/formDataCleanup";
import { getBaseSchema } from "@/utils/schemaViews";

/**
 * Property-based invariants for the variable normalization pipeline
 * (normalizeVariableFields → stripExtraVariableFields → cleanVariableData):
 *   - extra fields never survive the schema-driven strip (top-level and nested)
 *   - schema fields are never lost
 *   - the strip and the full import-normalization are idempotent (round-trip stable)
 *
 * Generators are derived from the real bundled schema so they stay in sync.
 */

const root = getBaseSchema() as unknown as JSONSchema;

// The 18 concrete variable classes, read from the discriminated union itself.
const VARIABLE_CLASSES: string[] = (
  root.$defs?.FieldDataset?.properties?.variables?.items?.oneOf ?? []
)
  .map((b) => b.$ref?.split("/").pop())
  .filter((name): name is string => typeof name === "string");

const classProps = (cls: string): string[] =>
  Object.keys(root.$defs?.[cls]?.properties ?? {}).filter((p) => p !== "schema_class");

const CLASSES_WITH_INSTRUMENT = VARIABLE_CLASSES.filter((c) =>
  classProps(c).includes("analyzing_instrument"),
);

// "zzjunk_"-prefixed keys are guaranteed not to be real schema fields, and don't
// start with "_" (so they exercise AJV removeAdditional, not the _-prefix strip).
const arbJunkKeys = fc.uniqueArray(
  fc.integer({ min: 0, max: 9999 }).map((n) => `zzjunk_${n}`),
  { maxLength: 4 },
);

interface GenVariable {
  cls: string;
  obj: Record<string, unknown>;
  knownKeys: string[];
  junkKeys: string[];
}

const arbVariable: fc.Arbitrary<GenVariable> = fc
  .constantFrom(...VARIABLE_CLASSES)
  .chain((cls) =>
    fc.record({
      cls: fc.constant(cls),
      knownKeys: fc.uniqueArray(fc.constantFrom(...classProps(cls)), {
        maxLength: 6,
      }),
      junkKeys: arbJunkKeys,
    }),
  )
  .map(({ cls, knownKeys, junkKeys }) => {
    const obj: Record<string, unknown> = { schema_class: cls };
    for (const j of junkKeys) obj[j] = "x";
    for (const k of knownKeys) obj[k] = "x";
    return { cls, obj, knownKeys, junkKeys };
  });

const importNormalize = (v: Record<string, unknown>): Record<string, unknown> =>
  cleanVariableData(
    stripExtraVariableFields(normalizeVariableFields(v), root) as Record<string, unknown>,
  );

describe("variable normalization invariants", () => {
  it("derived 18 variable classes from the bundled schema", () => {
    expect(VARIABLE_CLASSES.length).toBe(18);
    expect(CLASSES_WITH_INSTRUMENT.length).toBeGreaterThan(0);
  });

  it("strip removes every extra top-level field and keeps schema fields", () => {
    fc.assert(
      fc.property(arbVariable, ({ cls, obj, knownKeys, junkKeys }) => {
        const out = stripExtraVariableFields(obj, root);
        expect(out.schema_class).toBe(cls);
        for (const j of junkKeys) expect(out).not.toHaveProperty(j);
        for (const k of knownKeys) expect(out).toHaveProperty(k);
      }),
    );
  });

  it("strip is idempotent", () => {
    fc.assert(
      fc.property(arbVariable, ({ obj }) => {
        const once = stripExtraVariableFields(obj, root);
        const twice = stripExtraVariableFields(once, root);
        expect(twice).toEqual(once);
      }),
    );
  });

  it("import-normalization (normalize → strip → clean) is idempotent — round-trip stable", () => {
    fc.assert(
      fc.property(arbVariable, ({ obj }) => {
        const once = importNormalize(obj);
        const twice = importNormalize(once);
        expect(twice).toEqual(once);
      }),
    );
  });

  it("strip removes extra fields nested inside analyzing_instrument.calibration", () => {
    const arbNested = fc
      .constantFrom(...CLASSES_WITH_INSTRUMENT)
      .chain((cls) => fc.record({ cls: fc.constant(cls), junkKeys: arbJunkKeys }))
      .map(({ cls, junkKeys }) => ({
        obj: {
          schema_class: cls,
          analyzing_instrument: {
            calibration: Object.fromEntries(junkKeys.map((j) => [j, "x"])),
          },
        } as Record<string, unknown>,
        junkKeys,
      }));

    fc.assert(
      fc.property(arbNested, ({ obj, junkKeys }) => {
        const out = stripExtraVariableFields(obj, root);
        const instrument = out.analyzing_instrument as Record<string, unknown> | undefined;
        const calibration = (instrument?.calibration ?? {}) as Record<string, unknown>;
        for (const j of junkKeys) expect(calibration).not.toHaveProperty(j);
      }),
    );
  });
});
