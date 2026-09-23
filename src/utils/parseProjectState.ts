import type { JSONSchema } from "@/components/schemaUtils";
import type { ExperimentRecord } from "@/types/forms";
import type { ProjectState } from "@/workspace/types";
import { migrateFormData } from "./migrations";
import { parseDataset, parseExperiment, parseProject } from "./parseEntity";
import { getBaseSchema } from "./schemaViews";

/**
 * Parse a persisted project at the boundary. A project may have been saved
 * before the current invariants existed or under an older app version, so
 * parseExperiment/parseDataset re-establish model exclusivity, type-scoped
 * fields and clean variables, and migrate handles the legacy bounding box.
 */
export function parseProjectState(saved: ProjectState): ProjectState {
  const experiments = saved.experiments.map((exp) => {
    // Older saves carry a top-level copy of formData.experiment_types.
    const { experiment_types: _, ...record } = exp as ExperimentRecord & {
      experiment_types?: unknown;
    };
    return { ...record, formData: parseExperiment(migrateFormData(exp.formData)) };
  });
  const datasets = saved.datasets.map((ds) => ({
    ...ds,
    formData: parseDataset(migrateFormData(ds.formData), getBaseSchema() as unknown as JSONSchema),
  }));
  return {
    projectData: parseProject(migrateFormData(saved.projectData)),
    experiments,
    datasets,
    nextExperimentId: saved.nextExperimentId,
    nextDatasetId: saved.nextDatasetId,
  };
}
