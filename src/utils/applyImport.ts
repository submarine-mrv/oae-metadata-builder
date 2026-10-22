import type { DatasetExperimentLinking } from "@/hooks/useImportPreview";
import type {
  DatasetLinkingMetadata,
  DraftDataset,
  DraftExperiment,
  DraftProject,
} from "@/types/forms";
import type { ProjectState } from "@/workspace/types";
import { cleanFormData } from "./formDataCleanup";
import { propagateProjectId } from "./idPropagation";

export interface ImportSelection {
  project: DraftProject | null;
  experiments: DraftExperiment[];
  datasets: Array<{ formData: DraftDataset; experimentLinking?: DatasetExperimentLinking }>;
}

/**
 * Merge an import selection into a project. Experiments replace an existing
 * one with the same experiment_id; datasets are always added. Shared by the
 * in-place import and "import as a new project"; stamps records with Date.now().
 */
export function applyImport(prev: ProjectState, selection: ImportSelection): ProjectState {
  const { project: projectData, experiments, datasets } = selection;
  // Imported JSON may carry nulls and empty arrays that the edit path strips.
  const cleanedProjectData = projectData ? (cleanFormData(projectData) as DraftProject) : null;

  // Project: imported fields merge over the existing ones
  const newProjectData = cleanedProjectData
    ? { ...prev.projectData, ...cleanedProjectData }
    : prev.projectData;

  // Handle experiments - replace matching or add new
  // Track mapping from import key (e.g., "experiment-0") to internal ID for cross-import linking
  const importKeyToInternalId: Record<string, number> = {};
  const newExperiments = [...prev.experiments];
  let nextExpId = prev.nextExperimentId;

  experiments.forEach((rawExpData, index) => {
    const expData = cleanFormData(rawExpData) as DraftExperiment;
    const expId = expData.experiment_id as string | undefined;
    const expName = (expData.name as string) || expId;
    const importKey = `experiment-${index}`;

    // Find existing experiment by experiment_id or name
    const existingIndex = expId
      ? newExperiments.findIndex((e) => e.formData.experiment_id === expId || e.name === expId)
      : -1;

    if (existingIndex >= 0) {
      // Replace existing experiment
      newExperiments[existingIndex] = {
        ...newExperiments[existingIndex],
        formData: expData,
        name: expName || newExperiments[existingIndex].name,
        updatedAt: Date.now(),
      };
      // Map import key to existing internal ID
      importKeyToInternalId[importKey] = newExperiments[existingIndex].id;
    } else {
      // Add as new experiment
      const newInternalId = nextExpId;
      newExperiments.push({
        id: newInternalId,
        name: expName || `Experiment ${newInternalId}`,
        formData: expData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Map import key to new internal ID
      importKeyToInternalId[importKey] = newInternalId;
      nextExpId++;
    }
  });

  // Datasets: always added
  const newDatasets = [...prev.datasets];
  let nextDsId = prev.nextDatasetId;

  for (const { formData: rawDsData, experimentLinking } of datasets) {
    // Normalize incoming dataset data at the boundary.
    const dsData = cleanFormData(rawDsData) as DraftDataset;
    const dsName = dsData.name as string | undefined;

    // Resolve experiment linking to internal ID
    let linkedExperimentInternalId: number | null = null;

    if (experimentLinking) {
      if (experimentLinking.mode === "use-file") {
        // Use the resolved match from the preview
        const resolved = experimentLinking.resolvedMatch;
        if (resolved?.type === "existing" && resolved.internalId !== undefined) {
          linkedExperimentInternalId = resolved.internalId;
        } else if (resolved?.type === "importing" && resolved.importKey) {
          // Cross-import linking: map import key to the newly-assigned internal ID
          linkedExperimentInternalId = importKeyToInternalId[resolved.importKey] ?? null;
        }
      } else if (experimentLinking.mode === "explicit") {
        if (experimentLinking.explicitExperimentInternalId !== undefined) {
          // Explicitly linking to existing experiment
          linkedExperimentInternalId = experimentLinking.explicitExperimentInternalId;
        } else if (experimentLinking.explicitImportKey) {
          // Explicitly linking to importing experiment
          linkedExperimentInternalId =
            importKeyToInternalId[experimentLinking.explicitImportKey] ?? null;
        }
      }
    }

    // A link resolved against another project points at nothing here.
    if (
      linkedExperimentInternalId !== null &&
      !newExperiments.some((e) => e.id === linkedExperimentInternalId)
    ) {
      linkedExperimentInternalId = null;
    }

    // Find the linked experiment to get its experiment_id for the formData
    let experimentIdToSet: string | undefined;
    if (linkedExperimentInternalId !== null) {
      const linkedExp = newExperiments.find((e) => e.id === linkedExperimentInternalId);
      experimentIdToSet = linkedExp?.formData.experiment_id as string | undefined;
    }

    // experiment_id comes from the linked experiment; an unlinked dataset has none.
    const { experiment_id: _fileExperimentId, ...dsWithoutExperimentId } = dsData;
    const finalFormData: DraftDataset =
      linkedExperimentInternalId !== null && experimentIdToSet
        ? { ...dsData, experiment_id: experimentIdToSet }
        : dsWithoutExperimentId;

    // Build linking metadata for the dataset
    const datasetLinking: DatasetLinkingMetadata = {
      linkedExperimentInternalId,
    };

    // Always add datasets as new (no name-based override — unlike experiments
    // which have unique experiment_id, datasets can share names)
    newDatasets.push({
      id: nextDsId,
      name: dsName || `Dataset ${nextDsId}`,
      formData: finalFormData,
      linking: datasetLinking,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    nextDsId++;
  }

  // project_id and experiment_id are owned by the target project, never taken from the file.
  const projectId = newProjectData.project_id as string | undefined;
  return {
    projectData: newProjectData,
    experiments: propagateProjectId(newExperiments, projectId),
    datasets: propagateProjectId(newDatasets, projectId),
    nextExperimentId: nextExpId,
    nextDatasetId: nextDsId,
  };
}
