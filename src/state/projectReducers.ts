// Pure updates to one project's persisted data. Records are stamped with Date.now().

import type {
  DatasetLinkingMetadata,
  DatasetRecord,
  DraftDataset,
  DraftExperiment,
  DraftProject,
  ExperimentRecord,
} from "@/types/forms";
import { applyImport, type ImportSelection } from "@/utils/applyImport";
import { cleanFormData } from "@/utils/formDataCleanup";
import { propagateExperimentIdToDatasets, propagateProjectId } from "@/utils/idPropagation";
import type { ProjectState } from "@/workspace/types";

export interface WithId {
  state: ProjectState;
  id: number;
}

export function updateProjectData(state: ProjectState, rawData: DraftProject): ProjectState {
  const data = cleanFormData(rawData);
  const newProjectId = data.project_id;
  const changed = newProjectId !== state.projectData.project_id;
  return {
    ...state,
    projectData: data,
    experiments: changed ? propagateProjectId(state.experiments, newProjectId) : state.experiments,
    datasets: changed ? propagateProjectId(state.datasets, newProjectId) : state.datasets,
  };
}

// =============================================================================
// Experiments
// =============================================================================

export function addExperiment(state: ProjectState, name?: string): WithId {
  const id = state.nextExperimentId;
  const experiment: ExperimentRecord = {
    id,
    name: name || `Experiment ${id}`,
    formData: { project_id: state.projectData?.project_id || "" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return {
    state: {
      ...state,
      experiments: [...state.experiments, experiment],
      nextExperimentId: id + 1,
    },
    id,
  };
}

/** Replace an experiment's formData, so keys absent from `data` are cleared. */
export function replaceExperimentFormData(
  state: ProjectState,
  id: number,
  data: DraftExperiment,
): ProjectState {
  const cleaned = cleanFormData(data);
  const oldExpId = state.experiments.find((exp) => exp.id === id)?.formData?.experiment_id;
  const newExpId = cleaned.experiment_id;

  const experiments = state.experiments.map((exp) =>
    exp.id === id
      ? {
          ...exp,
          formData: cleaned as DraftExperiment,
          name: (cleaned.name as string) || exp.name,
          updatedAt: Date.now(),
        }
      : exp,
  );

  const datasets =
    newExpId !== oldExpId
      ? propagateExperimentIdToDatasets(state.datasets, id, (newExpId as string) || undefined)
      : state.datasets;

  return { ...state, experiments, datasets };
}

export function deleteExperiment(state: ProjectState, id: number): ProjectState {
  return { ...state, experiments: state.experiments.filter((exp) => exp.id !== id) };
}

/** Copy an experiment with " (Copy)" appended to its name. Returns the state unchanged and id 0 if not found. */
export function duplicateExperiment(state: ProjectState, id: number): WithId {
  const original = state.experiments.find((exp) => exp.id === id);
  if (!original) return { state, id: 0 };

  const newId = state.nextExperimentId;
  const newName = `${original.name} (Copy)`;
  const duplicate: ExperimentRecord = {
    ...structuredClone(original),
    id: newId,
    name: newName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // Keep the form's own name field in sync with the display name.
  if (duplicate.formData.name !== undefined) {
    duplicate.formData.name = newName;
  }
  // experiment_id is the user-set unique identifier, so the copy needs a new one.
  delete duplicate.formData.experiment_id;

  return {
    state: {
      ...state,
      experiments: [...state.experiments, duplicate],
      nextExperimentId: newId + 1,
    },
    id: newId,
  };
}

// =============================================================================
// Datasets
// =============================================================================

export function addDataset(state: ProjectState, name?: string): WithId {
  const id = state.nextDatasetId;
  const dataset: DatasetRecord = {
    id,
    name: name || `Dataset ${id}`,
    formData: { project_id: state.projectData?.project_id || "" },
    linking: { linkedExperimentInternalId: null },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return {
    state: {
      ...state,
      datasets: [...state.datasets, dataset],
      nextDatasetId: id + 1,
    },
    id,
  };
}

export function replaceDatasetFormData(
  state: ProjectState,
  id: number,
  data: DraftDataset,
): ProjectState {
  return {
    ...state,
    datasets: state.datasets.map((ds) =>
      ds.id === id
        ? {
            ...ds,
            formData: cleanFormData(data),
            name: (data.name as string) || ds.name,
            updatedAt: Date.now(),
          }
        : ds,
    ),
  };
}

export function deleteDataset(state: ProjectState, id: number): ProjectState {
  return { ...state, datasets: state.datasets.filter((ds) => ds.id !== id) };
}

/** Copy a dataset with " (Copy)" appended to its name. Returns the state unchanged and id 0 if not found. */
export function duplicateDataset(state: ProjectState, id: number): WithId {
  const original = state.datasets.find((ds) => ds.id === id);
  if (!original) return { state, id: 0 };

  const newId = state.nextDatasetId;
  const newName = `${original.name} (Copy)`;
  // structuredClone keeps the copy linked to the same experiment without sharing references.
  const duplicate: DatasetRecord = {
    ...structuredClone(original),
    id: newId,
    name: newName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // Keep the form's own name field in sync with the display name.
  if (duplicate.formData.name !== undefined) {
    duplicate.formData.name = newName;
  }

  return {
    state: {
      ...state,
      datasets: [...state.datasets, duplicate],
      nextDatasetId: newId + 1,
    },
    id: newId,
  };
}

/** Update a dataset's experiment link. Linking to an experiment copies its experiment_id. */
export function updateDatasetLinking(
  state: ProjectState,
  id: number,
  linking: Partial<DatasetLinkingMetadata>,
): ProjectState {
  return {
    ...state,
    datasets: state.datasets.map((ds) => {
      if (ds.id !== id) return ds;

      let formData = ds.formData;
      if (
        linking.linkedExperimentInternalId !== undefined &&
        linking.linkedExperimentInternalId !== ds.linking?.linkedExperimentInternalId &&
        linking.linkedExperimentInternalId !== null
      ) {
        const linkedExp = state.experiments.find(
          (exp) => exp.id === linking.linkedExperimentInternalId,
        );
        formData = {
          ...formData,
          experiment_id: (linkedExp?.formData?.experiment_id as string) || "",
        };
      }
      // Unlinking keeps the current experiment_id so the user can edit it.

      return {
        ...ds,
        linking: { ...ds.linking, ...linking } as DatasetLinkingMetadata,
        formData,
        updatedAt: Date.now(),
      };
    }),
  };
}

/** Merge an import selection into the project. */
export function importSelection(state: ProjectState, selection: ImportSelection): ProjectState {
  return { ...state, ...applyImport(state, selection) };
}
