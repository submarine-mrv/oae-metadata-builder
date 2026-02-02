import { useState, useCallback } from "react";
import type {
  ProjectFormData,
  ExperimentFormData,
  DatasetFormData,
  ExperimentState,
  DatasetState
} from "@/types/forms";

export type ImportItemType = "project" | "experiment" | "dataset";

export type ConflictType = "override" | "add-new" | null;

export interface ImportItem {
  /** Unique key for React rendering */
  key: string;
  /** Type of item */
  type: ImportItemType;
  /** ID from the data (project_id, experiment_id, or name for datasets) */
  id: string | null;
  /** Display name */
  name: string;
  /** The raw form data */
  data: ProjectFormData | ExperimentFormData | DatasetFormData;
  /** Whether this item is selected for import */
  selected: boolean;
  /** What will happen when imported */
  conflict: ConflictType;
  /** Human-readable explanation of what will happen */
  conflictReason: string;
}

interface ImportPreviewState {
  /** Whether the preview modal is open */
  isOpen: boolean;
  /** Items available for import */
  items: ImportItem[];
  /** Original filename for display */
  filename: string;
}

interface UseImportPreviewOptions {
  /** Current project data in session */
  currentProjectData: ProjectFormData;
  /** Current experiments in session */
  currentExperiments: ExperimentState[];
  /** Current datasets in session */
  currentDatasets: DatasetState[];
}

interface UseImportPreviewReturn {
  /** Current state */
  state: ImportPreviewState;
  /** Open the preview with parsed import data */
  openPreview: (
    filename: string,
    projectData: ProjectFormData,
    experiments: ExperimentFormData[],
    datasets: DatasetFormData[]
  ) => void;
  /** Close the preview */
  closePreview: () => void;
  /** Toggle selection of an item */
  toggleItem: (key: string) => void;
  /** Select all items */
  selectAll: () => void;
  /** Deselect all items */
  deselectAll: () => void;
  /** Get selected items for import */
  getSelectedItems: () => {
    project: ProjectFormData | null;
    experiments: ExperimentFormData[];
    datasets: DatasetFormData[];
  };
}

/**
 * Hook for managing import preview state.
 * Analyzes imported data against current session to detect conflicts.
 */
export function useImportPreview({
  currentProjectData,
  currentExperiments,
  currentDatasets
}: UseImportPreviewOptions): UseImportPreviewReturn {
  const [state, setState] = useState<ImportPreviewState>({
    isOpen: false,
    items: [],
    filename: ""
  });

  const openPreview = useCallback(
    (
      filename: string,
      projectData: ProjectFormData,
      experiments: ExperimentFormData[],
      datasets: DatasetFormData[]
    ) => {
      const items: ImportItem[] = [];

      // Add project item
      const hasExistingProject = Boolean(currentProjectData?.project_id);
      const importProjectId = projectData?.project_id;

      if (projectData && Object.keys(projectData).length > 0) {
        items.push({
          key: "project-0",
          type: "project",
          id: importProjectId || null,
          name: importProjectId || "Project",
          data: projectData,
          selected: true,
          conflict: hasExistingProject ? "override" : "add-new",
          conflictReason: hasExistingProject
            ? "Replace existing project metadata"
            : "Will set project metadata"
        });
      }

      // Add experiment items
      experiments.forEach((exp, index) => {
        const expId =
          (exp.experiment_id as string) || (exp.name as string) || null;
        const expName =
          (exp.name as string) || expId || `Experiment ${index + 1}`;

        // Check for conflict with existing experiments
        const existingExp = expId
          ? currentExperiments.find(
              (e) => e.formData.experiment_id === expId || e.name === expId
            )
          : null;

        const hasConflict = Boolean(existingExp);
        const isEmptyId = !expId;

        items.push({
          key: `experiment-${index}`,
          type: "experiment",
          id: expId,
          name: expName,
          data: exp,
          selected: true,
          conflict: isEmptyId
            ? "add-new"
            : hasConflict
              ? "override"
              : "add-new",
          conflictReason: isEmptyId
            ? "Add as new experiment"
            : hasConflict
              ? `Replace existing experiment: "${existingExp?.name}"`
              : "Add as new experiment"
        });
      });

      // Add dataset items
      datasets.forEach((ds, index) => {
        const dsName = (ds.name as string) || `Dataset ${index + 1}`;

        // Check for conflict with existing datasets by name
        const existingDs = currentDatasets.find((d) => d.name === dsName);

        const hasConflict = Boolean(existingDs);
        const isEmptyName = !ds.name;

        items.push({
          key: `dataset-${index}`,
          type: "dataset",
          id: dsName,
          name: dsName,
          data: ds,
          selected: true,
          conflict: isEmptyName
            ? "add-new"
            : hasConflict
              ? "override"
              : "add-new",
          conflictReason: isEmptyName
            ? "Add as new dataset"
            : hasConflict
              ? `Replace existing dataset: "${existingDs?.name}"`
              : "Add as new dataset"
        });
      });

      setState({
        isOpen: true,
        items,
        filename
      });
    },
    [currentProjectData, currentExperiments, currentDatasets]
  );

  const closePreview = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggleItem = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.key === key ? { ...item, selected: !item.selected } : item
      )
    }));
  }, []);

  const selectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, selected: true }))
    }));
  }, []);

  const deselectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, selected: false }))
    }));
  }, []);

  const getSelectedItems = useCallback(() => {
    const selectedItems = state.items.filter((item) => item.selected);

    const project = selectedItems.find((item) => item.type === "project");
    const experiments = selectedItems
      .filter((item) => item.type === "experiment")
      .map((item) => item.data as ExperimentFormData);
    const datasets = selectedItems
      .filter((item) => item.type === "dataset")
      .map((item) => item.data as DatasetFormData);

    return {
      project: project ? (project.data as ProjectFormData) : null,
      experiments,
      datasets
    };
  }, [state.items]);

  return {
    state,
    openPreview,
    closePreview,
    toggleItem,
    selectAll,
    deselectAll,
    getSelectedItems
  };
}
