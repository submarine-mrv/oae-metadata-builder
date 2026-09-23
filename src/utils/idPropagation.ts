import type { DatasetRecord, ExperimentRecord } from "@/types/forms";

/**
 * Set project_id on every experiment. project_id is always synced from the
 * project. Records that already match are returned unchanged.
 */
export function propagateProjectIdToExperiments(
  experiments: ExperimentRecord[],
  projectId: string | undefined,
): ExperimentRecord[] {
  const id = projectId || "";
  return experiments.map((exp) =>
    exp.formData.project_id === id
      ? exp
      : { ...exp, formData: { ...exp.formData, project_id: id }, updatedAt: Date.now() },
  );
}

/**
 * Set project_id on every dataset. project_id is always synced from the
 * project. Records that already match are returned unchanged.
 */
export function propagateProjectIdToDatasets(
  datasets: DatasetRecord[],
  projectId: string | undefined,
): DatasetRecord[] {
  const id = projectId || "";
  return datasets.map((ds) =>
    ds.formData.project_id === id
      ? ds
      : { ...ds, formData: { ...ds.formData, project_id: id }, updatedAt: Date.now() },
  );
}
