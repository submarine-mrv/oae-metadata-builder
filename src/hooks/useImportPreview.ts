import { useCallback, useState } from "react";
import type { DraftDataset, DraftExperiment, DraftProject, ExperimentRecord } from "@/types/forms";

export type ImportItemType = "project" | "experiment" | "dataset";

export type ConflictType = "override" | "add-new" | null;

/** How the experiment link was resolved */
export type ExperimentLinkResolutionType = "existing" | "importing" | "none";

/** Resolved experiment link information for display */
export interface ResolvedExperimentLink {
  type: ExperimentLinkResolutionType;
  /** Display name of the experiment */
  experimentName?: string;
  /** experiment_id field value */
  experimentId?: string;
  /** Import key for cross-import linking (e.g., "experiment-0") */
  importKey?: string;
  /** Internal ID if linking to existing experiment */
  internalId?: number;
}

/** Experiment linking configuration for datasets during import */
export interface DatasetExperimentLinking {
  /** How to determine the experiment link */
  mode: "use-file" | "explicit";
  /** Internal ID when mode='explicit' and linking to existing experiment */
  explicitExperimentInternalId?: number;
  /** Import key when mode='explicit' and linking to importing experiment */
  explicitImportKey?: string;
  /** Computed resolution for display */
  resolvedMatch?: ResolvedExperimentLink;
}

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
  data: DraftProject | DraftExperiment | DraftDataset;
  /** Whether this item is selected for import */
  selected: boolean;
  /** What will happen when imported */
  conflict: ConflictType;
  /** Human-readable explanation of what will happen */
  conflictReason: string;
  /** Experiment linking config - only for datasets */
  experimentLinking?: DatasetExperimentLinking;
}

interface ImportPreviewState {
  /** Whether the preview modal is open */
  isOpen: boolean;
  /** Items available for import */
  items: ImportItem[];
  /** Original filename for display */
  filename: string;
  /** Error if duplicate experiment_ids found in import file */
  duplicateExperimentIdError: string | null;
  /** The project the file is compared against */
  baseline: ImportBaseline;
}

/** The project an import is resolved against: the current one, or an empty one. */
export interface ImportBaseline {
  projectData: DraftProject;
  experiments: ExperimentRecord[];
}

export const EMPTY_BASELINE: ImportBaseline = { projectData: {}, experiments: [] };

/** Options for experiment linking dropdown */
export interface ExperimentLinkOption {
  /** Value for the select (e.g., "existing-1", "importing-experiment-0") */
  value: string;
  /** Display label */
  label: string;
}

interface UseImportPreviewReturn {
  /** Current state */
  state: ImportPreviewState;
  /** Open the preview with parsed import data */
  openPreview: (
    filename: string,
    projectData: DraftProject,
    experiments: DraftExperiment[],
    datasets: DraftDataset[],
    baseline: ImportBaseline,
  ) => void;
  /** Re-analyze the open file against another baseline, keeping selections */
  rebase: (baseline: ImportBaseline) => void;
  /** Close the preview */
  closePreview: () => void;
  /** Toggle selection of an item */
  toggleItem: (key: string) => void;
  /** Select all items */
  selectAll: () => void;
  /** Deselect all items */
  deselectAll: () => void;
  /** Set experiment linking for a dataset */
  setDatasetExperimentLinking: (
    datasetKey: string,
    mode: "use-file" | "explicit",
    explicitExperimentInternalId?: number,
    explicitImportKey?: string,
  ) => void;
  /** Get available experiment link options for a specific dataset */
  getExperimentLinkOptions: (datasetKey: string) => ExperimentLinkOption[];
  /** Get selected items for import with linking config */
  getSelectedItems: () => {
    project: DraftProject | null;
    experiments: DraftExperiment[];
    datasets: Array<{
      formData: DraftDataset;
      experimentLinking?: DatasetExperimentLinking;
    }>;
  };
}

/**
 * Resolve experiment link for a dataset based on its experiment_id
 */
function resolveExperimentLink(
  datasetExperimentId: string | undefined,
  existingExperiments: ExperimentRecord[],
  importingExperiments: Array<{ key: string; data: DraftExperiment }>,
): ResolvedExperimentLink {
  if (!datasetExperimentId) {
    return { type: "none" };
  }

  // Check existing experiments first
  const existingMatch = existingExperiments.find(
    (exp) => exp.formData.experiment_id === datasetExperimentId,
  );
  if (existingMatch) {
    return {
      type: "existing",
      experimentName: existingMatch.name,
      experimentId: datasetExperimentId,
      internalId: existingMatch.id,
    };
  }

  // Check importing experiments
  const importingMatch = importingExperiments.find(
    (exp) => (exp.data.experiment_id as string) === datasetExperimentId,
  );
  if (importingMatch) {
    return {
      type: "importing",
      experimentName: (importingMatch.data.name as string) || importingMatch.key,
      experimentId: datasetExperimentId,
      importKey: importingMatch.key,
    };
  }

  // No match found
  return { type: "none" };
}

/** Build preview items for a file, compared against the baseline project. */
function analyze(
  projectData: DraftProject,
  experiments: DraftExperiment[],
  datasets: DraftDataset[],
  baseline: ImportBaseline,
): { items: ImportItem[]; duplicateExperimentIdError: string | null } {
  const items: ImportItem[] = [];

  // Check for duplicate experiment_ids in the import file
  const experimentIds = experiments
    .map((exp) => exp.experiment_id as string)
    .filter((id) => id && id.trim() !== "");
  const duplicateIds = experimentIds.filter((id, index) => experimentIds.indexOf(id) !== index);
  const uniqueDuplicates = [...new Set(duplicateIds)];
  const duplicateExperimentIdError =
    uniqueDuplicates.length > 0
      ? `Cannot import: multiple experiments have the same experiment_id (${uniqueDuplicates.join(", ")})`
      : null;

  // Add project item
  const hasExistingProject = Boolean(baseline.projectData?.project_id);
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
        : "Will set project metadata",
    });
  }

  // Add experiment items
  experiments.forEach((exp, index) => {
    const expId = (exp.experiment_id as string) || (exp.name as string) || null;
    const expName = (exp.name as string) || expId || `Experiment ${index + 1}`;

    // Check for conflict with existing experiments
    const existingExp = expId
      ? baseline.experiments.find((e) => e.formData.experiment_id === expId || e.name === expId)
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
      conflict: isEmptyId ? "add-new" : hasConflict ? "override" : "add-new",
      conflictReason: isEmptyId
        ? "Add as new experiment"
        : hasConflict
          ? `Replace existing experiment: "${existingExp?.name}"`
          : "Add as new experiment",
    });
  });

  // Prepare importing experiments for cross-import resolution
  const importingExperiments = experiments.map((exp, index) => ({
    key: `experiment-${index}`,
    data: exp,
  }));

  // Add dataset items with experiment linking
  // Datasets are always added as new (no name-based override — unlike experiments
  // which have unique experiment_id, datasets can share names)
  datasets.forEach((ds, index) => {
    const dsName = (ds.name as string) || `Dataset ${index + 1}`;
    const dsExperimentId = ds.experiment_id as string | undefined;

    // Resolve experiment link for this dataset
    const resolvedMatch = resolveExperimentLink(
      dsExperimentId,
      baseline.experiments,
      importingExperiments,
    );

    items.push({
      key: `dataset-${index}`,
      type: "dataset",
      id: dsName,
      name: dsName,
      data: ds,
      selected: true,
      conflict: "add-new",
      conflictReason: "Add as new dataset",
      experimentLinking: {
        mode: "use-file",
        resolvedMatch,
      },
    });
  });

  return { items, duplicateExperimentIdError };
}

/**
 * Rewrite a dataset's import-key link to the compacted key of the selected
 * experiments. A link to a deselected experiment is dropped.
 */
function remapLinking(
  linking: DatasetExperimentLinking | undefined,
  keyMap: Map<string, string>,
): DatasetExperimentLinking | undefined {
  if (!linking) return linking;
  const importKey =
    linking.mode === "explicit"
      ? linking.explicitImportKey
      : linking.resolvedMatch?.type === "importing"
        ? linking.resolvedMatch.importKey
        : undefined;
  if (importKey === undefined) return linking;
  const mapped = keyMap.get(importKey);
  if (!mapped) return undefined;
  return {
    ...linking,
    ...(linking.explicitImportKey !== undefined && { explicitImportKey: mapped }),
    ...(linking.resolvedMatch?.type === "importing" && {
      resolvedMatch: { ...linking.resolvedMatch, importKey: mapped },
    }),
  };
}

/**
 * Hook for managing import preview state.
 * Analyzes imported data against a baseline project to detect conflicts.
 */
export function useImportPreview(): UseImportPreviewReturn {
  const [state, setState] = useState<ImportPreviewState>({
    isOpen: false,
    items: [],
    filename: "",
    duplicateExperimentIdError: null,
    baseline: EMPTY_BASELINE,
  });

  const openPreview = useCallback(
    (
      filename: string,
      projectData: DraftProject,
      experiments: DraftExperiment[],
      datasets: DraftDataset[],
      baseline: ImportBaseline,
    ) => {
      setState({
        isOpen: true,
        filename,
        baseline,
        ...analyze(projectData, experiments, datasets, baseline),
      });
    },
    [],
  );

  const rebase = useCallback((baseline: ImportBaseline) => {
    setState((prev) => {
      const byType = (type: ImportItemType) => prev.items.filter((i) => i.type === type);
      const projectData = (byType("project")[0]?.data ?? {}) as DraftProject;
      const experiments = byType("experiment").map((i) => i.data as DraftExperiment);
      const datasets = byType("dataset").map((i) => i.data as DraftDataset);
      const fresh = analyze(projectData, experiments, datasets, baseline);
      const previous = new Map(prev.items.map((i) => [i.key, i]));
      const items = fresh.items.map((item) => {
        const old = previous.get(item.key);
        if (!old) return item;
        // An explicit link to an importing experiment holds in either baseline.
        const keepLink =
          old.experimentLinking?.mode === "explicit" &&
          old.experimentLinking.explicitImportKey !== undefined;
        return {
          ...item,
          selected: old.selected,
          experimentLinking: keepLink ? old.experimentLinking : item.experimentLinking,
        };
      });
      return {
        ...prev,
        baseline,
        items,
        duplicateExperimentIdError: fresh.duplicateExperimentIdError,
      };
    });
  }, []);

  const closePreview = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggleItem = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.key === key ? { ...item, selected: !item.selected } : item,
      ),
    }));
  }, []);

  const selectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, selected: true })),
    }));
  }, []);

  const deselectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, selected: false })),
    }));
  }, []);

  /**
   * Set experiment linking for a dataset
   */
  const setDatasetExperimentLinking = useCallback(
    (
      datasetKey: string,
      mode: "use-file" | "explicit",
      explicitExperimentInternalId?: number,
      explicitImportKey?: string,
    ) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.key !== datasetKey || item.type !== "dataset") {
            return item;
          }

          // Compute resolved match based on mode
          let resolvedMatch: ResolvedExperimentLink;

          if (mode === "use-file") {
            // Re-resolve from file's experiment_id
            const dsData = item.data as DraftDataset;
            const dsExperimentId = dsData.experiment_id as string | undefined;

            // Get importing experiments from current items
            const importingExperiments = prev.items
              .filter((i) => i.type === "experiment")
              .map((i) => ({ key: i.key, data: i.data as DraftExperiment }));

            resolvedMatch = resolveExperimentLink(
              dsExperimentId,
              prev.baseline.experiments,
              importingExperiments,
            );
          } else if (explicitExperimentInternalId !== undefined) {
            // Linking to existing experiment
            const existingExp = prev.baseline.experiments.find(
              (e) => e.id === explicitExperimentInternalId,
            );
            resolvedMatch = existingExp
              ? {
                  type: "existing",
                  experimentName: existingExp.name,
                  experimentId: existingExp.formData.experiment_id as string,
                  internalId: existingExp.id,
                }
              : { type: "none" };
          } else if (explicitImportKey) {
            // Linking to importing experiment
            const importingExp = prev.items.find(
              (i) => i.key === explicitImportKey && i.type === "experiment",
            );
            const expData = importingExp?.data as DraftExperiment | undefined;
            resolvedMatch = importingExp
              ? {
                  type: "importing",
                  experimentName: (expData?.name as string) || importingExp.name,
                  experimentId: expData?.experiment_id as string,
                  importKey: explicitImportKey,
                }
              : { type: "none" };
          } else {
            resolvedMatch = { type: "none" };
          }

          return {
            ...item,
            experimentLinking: {
              mode,
              explicitExperimentInternalId,
              explicitImportKey,
              resolvedMatch,
            },
          };
        }),
      }));
    },
    [],
  );

  /**
   * Get available experiment link options for a specific dataset.
   * Returns flat list with dataset's file experiment_id first, then remaining options.
   */
  const getExperimentLinkOptions = useCallback(
    (datasetKey: string): ExperimentLinkOption[] => {
      const options: ExperimentLinkOption[] = [];

      // Find the dataset to get its experiment_id from file
      const dataset = state.items.find(
        (item) => item.key === datasetKey && item.type === "dataset",
      );
      const dsData = dataset?.data as DraftDataset | undefined;
      const fileExperimentId = dsData?.experiment_id as string | undefined;

      // Build the first option: the file's experiment_id
      if (fileExperimentId && fileExperimentId.trim() !== "") {
        // Check if there's a matching experiment (existing or importing)
        const existingMatch = state.baseline.experiments.find(
          (exp) => exp.formData.experiment_id === fileExperimentId,
        );
        const importingMatch = state.items.find(
          (item) =>
            item.type === "experiment" &&
            item.selected &&
            (item.data as DraftExperiment).experiment_id === fileExperimentId,
        );

        let firstLabel: string;
        if (existingMatch) {
          firstLabel = `${existingMatch.name} (${fileExperimentId})`;
        } else if (importingMatch) {
          firstLabel = `${importingMatch.name} (${fileExperimentId})`;
        } else {
          // No match - show raw experiment_id
          firstLabel = fileExperimentId;
        }

        options.push({
          value: "use-file",
          label: firstLabel,
        });
      } else {
        // No experiment_id in file
        options.push({
          value: "use-file",
          label: "(no experiment)",
        });
      }

      // Add remaining existing experiments (excluding any that match the file's experiment_id)
      state.baseline.experiments.forEach((exp) => {
        const expId = exp.formData.experiment_id as string;
        // Skip if this matches the file's experiment_id (already shown as first option)
        if (fileExperimentId && expId === fileExperimentId) {
          return;
        }
        const label = expId ? `${exp.name} (${expId})` : exp.name;
        options.push({
          value: `existing-${exp.id}`,
          label,
        });
      });

      // Add remaining importing experiments (only selected ones, excluding file match)
      const importingExps = state.items.filter(
        (item) => item.type === "experiment" && item.selected,
      );
      importingExps.forEach((exp) => {
        const expData = exp.data as DraftExperiment;
        const expId = expData.experiment_id as string;
        // Skip if this matches the file's experiment_id (already shown as first option)
        if (fileExperimentId && expId === fileExperimentId) {
          return;
        }
        const label = expId ? `${exp.name} (${expId})` : exp.name;
        options.push({
          value: `importing-${exp.key}`,
          label,
        });
      });

      return options;
    },
    [state.baseline, state.items],
  );

  const getSelectedItems = useCallback(() => {
    const selectedItems = state.items.filter((item) => item.selected);

    const project = selectedItems.find((item) => item.type === "project");
    const selectedExperiments = selectedItems.filter((item) => item.type === "experiment");
    const experiments = selectedExperiments.map((item) => item.data as DraftExperiment);
    // applyImport keys experiments by position in this list, not in the file.
    const keyMap = new Map(
      selectedExperiments.map((item, index) => [item.key, `experiment-${index}`]),
    );
    const datasets = selectedItems
      .filter((item) => item.type === "dataset")
      .map((item) => ({
        formData: item.data as DraftDataset,
        experimentLinking: remapLinking(item.experimentLinking, keyMap),
      }));

    return {
      project: project ? (project.data as DraftProject) : null,
      experiments,
      datasets,
    };
  }, [state.items]);

  return {
    state,
    openPreview,
    rebase,
    closePreview,
    toggleItem,
    selectAll,
    deselectAll,
    setDatasetExperimentLinking,
    getExperimentLinkOptions,
    getSelectedItems,
  };
}
