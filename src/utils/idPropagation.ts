import type { DatasetRecord, ExperimentRecord } from "@/types/forms";

/**
 * Set project_id on every experiment or dataset. project_id is always synced
 * from the project. Records that already match are returned unchanged.
 */
export function propagateProjectId<T extends ExperimentRecord | DatasetRecord>(
  records: T[],
  projectId: string | undefined,
): T[] {
  const id = projectId || "";
  return records.map((r) =>
    r.formData.project_id === id
      ? r
      : { ...r, formData: { ...r.formData, project_id: id }, updatedAt: Date.now() },
  );
}

/** Set experiment_id on the datasets linked to the given experiment. Other datasets are returned unchanged. */
export function propagateExperimentIdToDatasets(
  datasets: DatasetRecord[],
  experimentInternalId: number,
  experimentId: string | undefined,
): DatasetRecord[] {
  return datasets.map((ds) =>
    ds.linking?.linkedExperimentInternalId !== experimentInternalId
      ? ds
      : {
          ...ds,
          formData: { ...ds.formData, experiment_id: experimentId || undefined },
          updatedAt: Date.now(),
        },
  );
}
