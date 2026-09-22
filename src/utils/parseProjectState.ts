import type { JSONSchema } from "@/components/schemaUtils";
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
    const formData = parseExperiment(migrateFormData(exp.formData));
    return {
      ...exp,
      formData,
      // A legacy session may carry a stale top-level copy that the parse just normalized.
      experiment_types: formData.experiment_types,
    };
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
