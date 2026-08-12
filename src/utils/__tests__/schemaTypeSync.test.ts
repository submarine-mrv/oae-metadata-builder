import { describe, expect, it } from "vitest";
import bundled from "@/schema/schema.bundled.json";
import { NON_MODEL_TYPES } from "@/types/forms";
import { getValidDatasetFieldsForType } from "@/utils/datasetFields";
import { getValidFieldsForType } from "@/utils/experimentFields";

/**
 * Guards the few places where TypeScript types or field lists hand-mirror
 * schema vocabulary. If the schema evolves, these fail loudly instead of the
 * app silently misbehaving (mistyped unions, or parse boundaries dropping
 * fields that cleanFormDataForType doesn't know about).
 */

type SchemaDefs = Record<string, { properties?: Record<string, unknown> }>;
const defs = (bundled as unknown as { $defs: SchemaDefs }).$defs;

function classProperties(className: string): string[] {
  const cls = defs[className];
  expect(cls, `schema class ${className} should exist`).toBeDefined();
  return Object.keys(cls.properties ?? {});
}

describe("experiment_types vocabulary sync", () => {
  it("NON_MODEL_TYPES + model matches the bundled schema exactly", () => {
    const items = (
      defs.Experiment.properties?.experiment_types as {
        items?: { oneOf?: Array<{ const: string }> };
      }
    )?.items?.oneOf;
    expect(items, "Experiment.experiment_types items.oneOf").toBeDefined();
    const schemaValues = (items ?? []).map((o) => o.const).sort();
    const tsValues = [...NON_MODEL_TYPES, "model"].sort();
    expect(schemaValues).toEqual(tsValues);
  });
});

describe("dataset_type structural facts", () => {
  it("model_output is a DatasetType value", () => {
    const values = (defs.DatasetType as { enum?: string[] }).enum ?? [];
    expect(values).toContain("model_output");
  });

  it("both dataset types carry variables, over different variable classes", () => {
    expect(classProperties("ModelOutputDataset")).toContain("variables");
    expect(classProperties("FieldDataset")).toContain("variables");

    // ModelOutputDataset takes exactly one class; FieldDataset takes a union.
    const modelItems = (
      defs.ModelOutputDataset as unknown as {
        properties: Record<string, { items?: { $ref?: string } }>;
      }
    ).properties.variables.items;
    expect(modelItems?.$ref).toBe("#/$defs/ModelOutputVariable");

    const fieldItems = (
      defs.FieldDataset as unknown as {
        properties: Record<string, { items?: { oneOf?: unknown[]; anyOf?: unknown[] } }>;
      }
    ).properties.variables.items;
    expect((fieldItems?.oneOf ?? fieldItems?.anyOf)?.length).toBeGreaterThan(1);
  });

  it("ModelOutputVariable carries only identity, name and units", () => {
    expect(classProperties("ModelOutputVariable").sort()).toEqual([
      "dataset_variable_name",
      "long_name",
      "schema_class",
      "standard_identifier",
      "units",
      "variable_type",
    ]);
  });
});

describe("field-list sync (parse boundaries must not drop schema fields)", () => {
  // cleanFormDataForType keeps only listed fields, and parseExperiment/
  // parseDataset now run it on every inbound path — so every property of the
  // selected schema class must be present in the corresponding valid-field
  // list, or imports would silently lose data.
  const experimentTypeToClass: Record<string, string> = {
    in_situ: "InSituExperiment",
    intervention: "Intervention",
    tracer_study: "Tracer",
    intervention_with_tracer: "InterventionWithTracer",
    model: "Model",
  };

  for (const [schemaType, className] of Object.entries(experimentTypeToClass)) {
    it(`getValidFieldsForType("${schemaType}") covers all ${className} properties`, () => {
      const valid = getValidFieldsForType(schemaType);
      const missing = classProperties(className).filter((p) => !valid.has(p));
      expect(missing).toEqual([]);
    });
  }

  it('getValidDatasetFieldsForType("model_output") covers all ModelOutputDataset properties', () => {
    const valid = getValidDatasetFieldsForType("model_output");
    const missing = classProperties("ModelOutputDataset").filter((p) => !valid.has(p));
    expect(missing).toEqual([]);
  });

  it("getValidDatasetFieldsForType(field type) covers all FieldDataset properties", () => {
    const valid = getValidDatasetFieldsForType("bottle");
    const missing = classProperties("FieldDataset").filter((p) => !valid.has(p));
    expect(missing).toEqual([]);
  });
});
