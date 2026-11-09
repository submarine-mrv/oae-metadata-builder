import { getDatasetSchema, getExperimentSchema, getProjectSchema } from "@/utils/schemaViews";

const schemas = {
  project: getProjectSchema,
  experiment: getExperimentSchema,
  dataset: getDatasetSchema,
};

/** The form label for a top-level field, falling back to its key. */
export function fieldLabel(kind: keyof typeof schemas, key: string): string {
  const properties = (schemas[kind]() as { properties?: Record<string, { title?: unknown }> })
    .properties;
  const title = properties?.[key]?.title;
  return typeof title === "string" && title.trim() ? title : key;
}
