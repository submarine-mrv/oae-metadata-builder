import type { JSONSchema } from "@/components/schemaUtils";
import type { ExperimentRecord } from "@/types/forms";
import type { ProjectState } from "@/workspace/types";
import { migrateDataset, migrateExperiment, migrateProject } from "./migrations";
import { parseDataset, parseExperiment, parseProject } from "./parseEntity";
import { getBaseSchema } from "./schemaViews";

/**
 * Parse a persisted project at the boundary. A project may have been saved
 * before the current invariants existed or under an older app version, so
 * parseExperiment/parseDataset re-establish model exclusivity, type-scoped
 * fields and clean variables, and migrate handles the legacy bounding box.
 */
/** Drafts from before UUIDs number entities; every tab maps them to the same strings. */
const legacyId = (kind: "experiment" | "dataset", id: unknown) =>
  typeof id === "number" ? `${kind}-${id}` : (id as string);

export function parseProjectState(saved: ProjectState): ProjectState {
  const experimentIds = new Set(saved.experiments.map((exp) => legacyId("experiment", exp.id)));
  const experiments = saved.experiments.map((exp) => {
    // Older saves carry a top-level copy of formData.experiment_types.
    const { experiment_types: _, ...record } = exp as ExperimentRecord & {
      experiment_types?: unknown;
    };
    return {
      ...record,
      id: legacyId("experiment", exp.id),
      formData: parseExperiment(migrateExperiment(exp.formData)),
    };
  });
  const datasets = saved.datasets.map((ds) => {
    const linked = ds.linking?.linkedExperimentInternalId;
    const linkedId = linked == null ? null : legacyId("experiment", linked);
    return {
      ...ds,
      id: legacyId("dataset", ds.id),
      formData: parseDataset(migrateDataset(ds.formData), getBaseSchema() as unknown as JSONSchema),
      ...(ds.linking
        ? {
            linking: {
              ...ds.linking,
              linkedExperimentInternalId: linkedId && experimentIds.has(linkedId) ? linkedId : null,
            },
          }
        : {}),
    };
  });
  // Counters from before UUIDs are dropped.
  return {
    projectData: parseProject(migrateProject(saved.projectData)),
    experiments,
    datasets,
  };
}
