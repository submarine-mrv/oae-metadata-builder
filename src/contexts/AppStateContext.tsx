"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import {
  calculateFormCompletion,
  calculateProjectCompletion
} from "@/utils/completionCalculator";
import type {
  ProjectFormData,
  ExperimentFormData,
  ExperimentState,
  DatasetFormData,
  DatasetState,
  AppFormState,
  ExperimentLinkingMetadata,
  DatasetLinkingMetadata
} from "@/types/forms";
import type { DatasetExperimentLinking } from "@/hooks/useImportPreview";

// Re-export types for backward compatibility
export type ExperimentData = ExperimentState;
export type DatasetData = DatasetState;

export type AppState = AppFormState;

// =============================================================================
// ID Propagation Helpers
// =============================================================================

/**
 * Propagate project_id to all experiments that are linked to the project.
 * Only updates experiments where linking.usesLinkedProjectId is true.
 */
function propagateProjectIdToExperiments(
  experiments: ExperimentState[],
  projectId: string | undefined
): ExperimentState[] {
  return experiments.map((exp) => {
    // If linking is undefined, treat as legacy (no linking) - don't auto-sync
    if (!exp.linking?.usesLinkedProjectId) {
      return exp;
    }
    // Update project_id in formData
    return {
      ...exp,
      formData: {
        ...exp.formData,
        project_id: projectId || ""
      },
      updatedAt: Date.now()
    };
  });
}

/**
 * Propagate project_id to all datasets that are linked to the project.
 * Only updates datasets where linking.usesLinkedProjectId is true.
 */
function propagateProjectIdToDatasets(
  datasets: DatasetState[],
  projectId: string | undefined
): DatasetState[] {
  return datasets.map((ds) => {
    // If linking is undefined, treat as legacy (no linking) - don't auto-sync
    if (!ds.linking?.usesLinkedProjectId) {
      return ds;
    }
    // Update project_id in formData
    return {
      ...ds,
      formData: {
        ...ds.formData,
        project_id: projectId || ""
      },
      updatedAt: Date.now()
    };
  });
}

/**
 * Propagate experiment_id to all datasets linked to the given experiment.
 * Only updates datasets where linking.linkedExperimentInternalId matches.
 */
function propagateExperimentIdToDatasets(
  datasets: DatasetState[],
  experimentInternalId: number,
  experimentId: string | undefined
): DatasetState[] {
  return datasets.map((ds) => {
    // Only update if this dataset is linked to this specific experiment
    if (ds.linking?.linkedExperimentInternalId !== experimentInternalId) {
      return ds;
    }
    // Update experiment_id in formData
    return {
      ...ds,
      formData: {
        ...ds.formData,
        experiment_id: experimentId || ""
      },
      updatedAt: Date.now()
    };
  });
}

interface AppStateContextType {
  state: AppState;
  updateProjectData: (data: ProjectFormData) => void;
  addExperiment: (name?: string) => number;
  updateExperiment: (id: number, data: Partial<ExperimentFormData> & { name?: string; experiment_type?: string }) => void;
  deleteExperiment: (id: number) => void;
  setActiveTab: (tab: "overview" | "project" | "experiment" | "dataset") => void;
  setActiveExperiment: (id: number | null) => void;
  getExperiment: (id: number) => ExperimentData | undefined;
  getProjectCompletionPercentage: () => number;
  getExperimentCompletionPercentage: (id: number) => number;
  importAllData: (projectData: ProjectFormData, experiments: ExperimentData[], datasets: DatasetData[]) => void;
  /** Import selected data, merging with existing (replaces matching items, adds new ones) */
  importSelectedData: (
    projectData: ProjectFormData | null,
    experiments: ExperimentFormData[],
    datasets: Array<{
      formData: DatasetFormData;
      experimentLinking?: DatasetExperimentLinking;
    }>
  ) => void;
  setTriggerValidation: (trigger: boolean) => void;
  setShowJsonPreview: (show: boolean) => void;
  toggleJsonPreview: () => void;
  // Dataset methods
  addDataset: (name?: string) => number;
  updateDataset: (id: number, data: Partial<DatasetFormData> & { name?: string }) => void;
  deleteDataset: (id: number) => void;
  setActiveDataset: (id: number | null) => void;
  getDataset: (id: number) => DatasetData | undefined;
  // ID Linking methods
  updateExperimentLinking: (id: number, linking: Partial<ExperimentLinkingMetadata>) => void;
  updateDatasetLinking: (id: number, linking: Partial<DatasetLinkingMetadata>) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(
  undefined
);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    projectData: { project_id: "" },
    experiments: [],
    datasets: [],
    activeTab: "overview",
    activeExperimentId: null,
    activeDatasetId: null,
    nextExperimentId: 1,
    nextDatasetId: 1,
    triggerValidation: false,
    showJsonPreview: false
  });

  const updateProjectData = useCallback((data: ProjectFormData) => {
    setState((prev) => {
      const newProjectId = data.project_id;
      const oldProjectId = prev.projectData.project_id;

      // If project_id changed, propagate to linked experiments and datasets
      const experimentsNeedUpdate = newProjectId !== oldProjectId;
      const newExperiments = experimentsNeedUpdate
        ? propagateProjectIdToExperiments(prev.experiments, newProjectId)
        : prev.experiments;
      const newDatasets = experimentsNeedUpdate
        ? propagateProjectIdToDatasets(prev.datasets, newProjectId)
        : prev.datasets;

      return {
        ...prev,
        projectData: data,
        experiments: newExperiments,
        datasets: newDatasets
      };
    });
  }, []);

  const addExperiment = useCallback(
    (name?: string): number => {
      // Use a ref to reliably capture the assigned ID
      const idRef = { current: 0 };

      setState((prev) => {
        const id = prev.nextExperimentId;
        idRef.current = id;
        const defaultName = name || `Experiment ${id}`;

        const newExperiment: ExperimentData = {
          id,
          name: defaultName,
          formData: {
            project_id: prev.projectData?.project_id || ""
          },
          // Initialize with linked mode - new experiments auto-sync project_id
          linking: {
            usesLinkedProjectId: true
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        return {
          ...prev,
          experiments: [...prev.experiments, newExperiment],
          activeExperimentId: id,
          nextExperimentId: prev.nextExperimentId + 1
        };
      });

      return idRef.current;
    },
    []
  );

  const updateExperiment = useCallback(
    (id: number, data: Partial<ExperimentFormData> & { name?: string; experiment_type?: string }) => {
      setState((prev) => {
        // Find the existing experiment to check for experiment_id changes
        const existingExp = prev.experiments.find((exp) => exp.id === id);
        const oldExpId = existingExp?.formData?.experiment_id;
        const newExpId = data.experiment_id;

        // Update experiments
        const newExperiments = prev.experiments.map((exp) =>
          exp.id === id
            ? {
                ...exp,
                formData: { ...exp.formData, ...data } as ExperimentFormData,
                experiment_type: data.experiment_type || exp.experiment_type,
                name: data.name || exp.name,
                updatedAt: Date.now()
              }
            : exp
        );

        // If experiment_id changed, propagate to linked datasets
        const expIdChanged = newExpId !== undefined && newExpId !== oldExpId;
        const newDatasets = expIdChanged
          ? propagateExperimentIdToDatasets(prev.datasets, id, newExpId as string)
          : prev.datasets;

        return {
          ...prev,
          experiments: newExperiments,
          datasets: newDatasets
        };
      });
    },
    []
  );

  const deleteExperiment = useCallback((id: number) => {
    setState((prev) => ({
      ...prev,
      experiments: prev.experiments.filter((exp) => exp.id !== id),
      activeExperimentId:
        prev.activeExperimentId === id ? null : prev.activeExperimentId
    }));
  }, []);

  const setActiveTab = useCallback(
    (tab: "overview" | "project" | "experiment" | "dataset") => {
      setState((prev) => ({
        ...prev,
        activeTab: tab
      }));
    },
    []
  );

  const setActiveExperiment = useCallback((id: number | null) => {
    setState((prev) => ({
      ...prev,
      activeExperimentId: id
    }));
  }, []);

  const getExperiment = useCallback(
    (id: number) => {
      return state.experiments.find((exp) => exp.id === id);
    },
    [state.experiments]
  );

  const getProjectCompletionPercentage = useCallback(() => {
    return calculateProjectCompletion(state.projectData);
  }, [state.projectData]);

  const getExperimentCompletionPercentage = useCallback(
    (id: number) => {
      const experiment = state.experiments.find((exp) => exp.id === id);
      if (!experiment) return 0;

      return calculateFormCompletion(
        experiment.formData,
        experiment.experiment_type
      );
    },
    [state.experiments]
  );

  // =============================================================================
  // Dataset Methods
  // =============================================================================

  const addDataset = useCallback(
    (name?: string): number => {
      const idRef = { current: 0 };

      setState((prev) => {
        const id = prev.nextDatasetId;
        idRef.current = id;
        const defaultName = name || `Dataset ${id}`;

        const newDataset: DatasetData = {
          id,
          name: defaultName,
          formData: {
            project_id: prev.projectData?.project_id || ""
          },
          // Initialize with linked mode for project, no experiment link
          linking: {
            usesLinkedProjectId: true,
            linkedExperimentInternalId: null
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        return {
          ...prev,
          datasets: [...prev.datasets, newDataset],
          activeDatasetId: id,
          nextDatasetId: prev.nextDatasetId + 1
        };
      });

      return idRef.current;
    },
    []
  );

  const updateDataset = useCallback(
    (id: number, data: Partial<DatasetFormData> & { name?: string }) => {
      setState((prev) => ({
        ...prev,
        datasets: prev.datasets.map((ds) =>
          ds.id === id
            ? {
                ...ds,
                formData: { ...ds.formData, ...data } as DatasetFormData,
                name: data.name || ds.name,
                updatedAt: Date.now()
              }
            : ds
        )
      }));
    },
    []
  );

  const deleteDataset = useCallback((id: number) => {
    setState((prev) => ({
      ...prev,
      datasets: prev.datasets.filter((ds) => ds.id !== id),
      activeDatasetId:
        prev.activeDatasetId === id ? null : prev.activeDatasetId
    }));
  }, []);

  const setActiveDataset = useCallback((id: number | null) => {
    setState((prev) => ({
      ...prev,
      activeDatasetId: id
    }));
  }, []);

  const getDataset = useCallback(
    (id: number) => {
      return state.datasets.find((ds) => ds.id === id);
    },
    [state.datasets]
  );

  // =============================================================================
  // ID Linking Methods
  // =============================================================================

  /**
   * Update experiment linking metadata and sync formData if needed.
   * When switching to linked mode, immediately sync the project_id.
   */
  const updateExperimentLinking = useCallback(
    (id: number, linking: Partial<ExperimentLinkingMetadata>) => {
      setState((prev) => ({
        ...prev,
        experiments: prev.experiments.map((exp) => {
          if (exp.id !== id) return exp;

          const newLinking = {
            ...exp.linking,
            ...linking
          } as ExperimentLinkingMetadata;

          // If switching to linked mode, sync project_id from project
          let newFormData = exp.formData;
          if (linking.usesLinkedProjectId && !exp.linking?.usesLinkedProjectId) {
            newFormData = {
              ...exp.formData,
              project_id: prev.projectData.project_id || ""
            };
          }

          return {
            ...exp,
            linking: newLinking,
            formData: newFormData,
            updatedAt: Date.now()
          };
        })
      }));
    },
    []
  );

  /**
   * Update dataset linking metadata and sync formData if needed.
   * When switching to linked mode, immediately sync the relevant IDs.
   */
  const updateDatasetLinking = useCallback(
    (id: number, linking: Partial<DatasetLinkingMetadata>) => {
      setState((prev) => ({
        ...prev,
        datasets: prev.datasets.map((ds) => {
          if (ds.id !== id) return ds;

          const newLinking = {
            ...ds.linking,
            ...linking
          } as DatasetLinkingMetadata;

          let newFormData = ds.formData;

          // If switching to linked project mode, sync project_id from project
          if (linking.usesLinkedProjectId && !ds.linking?.usesLinkedProjectId) {
            newFormData = {
              ...newFormData,
              project_id: prev.projectData.project_id || ""
            };
          }

          // If linking to an experiment, sync experiment_id from that experiment
          if (
            linking.linkedExperimentInternalId !== undefined &&
            linking.linkedExperimentInternalId !== ds.linking?.linkedExperimentInternalId
          ) {
            if (linking.linkedExperimentInternalId !== null) {
              // Find the experiment and get its experiment_id
              const linkedExp = prev.experiments.find(
                (exp) => exp.id === linking.linkedExperimentInternalId
              );
              newFormData = {
                ...newFormData,
                experiment_id: (linkedExp?.formData?.experiment_id as string) || ""
              };
            }
            // If setting to null, we leave the current value (user can manually edit)
          }

          return {
            ...ds,
            linking: newLinking,
            formData: newFormData,
            updatedAt: Date.now()
          };
        })
      }));
    },
    []
  );

  // Import all data (project + experiments + datasets) from imported file
  const importAllData = useCallback(
    (projectData: ProjectFormData, experiments: ExperimentData[], datasets: DatasetData[] = []) => {
      // Reassign experiment IDs to avoid conflicts
      const nextExpId = state.nextExperimentId;
      const experimentsWithNewIds = experiments.map((exp, index) => ({
        ...exp,
        id: nextExpId + index
      }));

      // Reassign dataset IDs to avoid conflicts
      const nextDsId = state.nextDatasetId;
      const datasetsWithNewIds = datasets.map((ds, index) => ({
        ...ds,
        id: nextDsId + index
      }));

      setState((prev) => ({
        projectData,
        experiments: experimentsWithNewIds,
        datasets: datasetsWithNewIds,
        activeTab: "overview",
        activeExperimentId: null,
        activeDatasetId: null,
        nextExperimentId: nextExpId + experiments.length,
        nextDatasetId: nextDsId + datasets.length,
        triggerValidation: false,
        showJsonPreview: prev.showJsonPreview
      }));
    },
    [state.nextExperimentId, state.nextDatasetId]
  );

  // Import selected data, merging with existing session
  // - Project: replaces existing project data if provided
  // - Experiments: replaces matching experiment_id, or adds new if no match/empty id
  // - Datasets: replaces matching name, or adds new if no match/empty name
  //   - Also applies experiment linking configuration
  const importSelectedData = useCallback(
    (
      projectData: ProjectFormData | null,
      experiments: ExperimentFormData[],
      datasets: Array<{
        formData: DatasetFormData;
        experimentLinking?: DatasetExperimentLinking;
      }>
    ) => {
      setState((prev) => {
        // Handle project - simply replace if provided
        const newProjectData = projectData
          ? { ...prev.projectData, ...projectData }
          : prev.projectData;

        // Handle experiments - replace matching or add new
        // Track mapping from import key (e.g., "experiment-0") to internal ID for cross-import linking
        const importKeyToInternalId: Record<string, number> = {};
        const newExperiments = [...prev.experiments];
        let nextExpId = prev.nextExperimentId;

        experiments.forEach((expData, index) => {
          const expId = expData.experiment_id as string | undefined;
          const expName = (expData.name as string) || expId;
          const importKey = `experiment-${index}`;

          // Find existing experiment by experiment_id or name
          const existingIndex = expId
            ? newExperiments.findIndex(
                (e) => e.formData.experiment_id === expId || e.name === expId
              )
            : -1;

          if (existingIndex >= 0) {
            // Replace existing experiment
            newExperiments[existingIndex] = {
              ...newExperiments[existingIndex],
              formData: expData,
              name: expName || newExperiments[existingIndex].name,
              experiment_type: expData.experiment_type,
              updatedAt: Date.now()
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
              experiment_type: expData.experiment_type,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
            // Map import key to new internal ID
            importKeyToInternalId[importKey] = newInternalId;
            nextExpId++;
          }
        });

        // Handle datasets - replace matching or add new
        const newDatasets = [...prev.datasets];
        let nextDsId = prev.nextDatasetId;

        for (const { formData: dsData, experimentLinking } of datasets) {
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

          // Find the linked experiment to get its experiment_id for the formData
          let experimentIdToSet: string | undefined;
          if (linkedExperimentInternalId !== null) {
            const linkedExp = newExperiments.find((e) => e.id === linkedExperimentInternalId);
            experimentIdToSet = linkedExp?.formData.experiment_id as string | undefined;
          }

          // Update formData with resolved experiment_id if linking is set
          const finalFormData: DatasetFormData =
            linkedExperimentInternalId !== null && experimentIdToSet
              ? { ...dsData, experiment_id: experimentIdToSet }
              : dsData;

          // Find existing dataset by name
          const existingIndex = dsName
            ? newDatasets.findIndex((d) => d.name === dsName)
            : -1;

          // Build linking metadata for the dataset
          const datasetLinking: DatasetLinkingMetadata = {
            usesLinkedProjectId: true, // Default to linked for imports
            linkedExperimentInternalId
          };

          if (existingIndex >= 0) {
            // Replace existing dataset
            newDatasets[existingIndex] = {
              ...newDatasets[existingIndex],
              formData: finalFormData,
              name: dsName || newDatasets[existingIndex].name,
              linking: datasetLinking,
              updatedAt: Date.now()
            };
          } else {
            // Add as new dataset
            newDatasets.push({
              id: nextDsId,
              name: dsName || `Dataset ${nextDsId}`,
              formData: finalFormData,
              linking: datasetLinking,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
            nextDsId++;
          }
        }

        return {
          ...prev,
          projectData: newProjectData,
          experiments: newExperiments,
          datasets: newDatasets,
          nextExperimentId: nextExpId,
          nextDatasetId: nextDsId,
          activeTab: "overview" as const
        };
      });
    },
    []
  );

  const setTriggerValidation = useCallback((trigger: boolean) => {
    setState((prev) => ({
      ...prev,
      triggerValidation: trigger
    }));
  }, []);

  const setShowJsonPreview = useCallback((show: boolean) => {
    setState((prev) => ({
      ...prev,
      showJsonPreview: show
    }));
  }, []);

  const toggleJsonPreview = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showJsonPreview: !prev.showJsonPreview
    }));
  }, []);

  const value: AppStateContextType = {
    state,
    updateProjectData,
    addExperiment,
    updateExperiment,
    deleteExperiment,
    setActiveTab,
    setActiveExperiment,
    getExperiment,
    getProjectCompletionPercentage,
    getExperimentCompletionPercentage,
    importAllData,
    importSelectedData,
    setTriggerValidation,
    setShowJsonPreview,
    toggleJsonPreview,
    // Dataset methods
    addDataset,
    updateDataset,
    deleteDataset,
    setActiveDataset,
    getDataset,
    // ID Linking methods
    updateExperimentLinking,
    updateDatasetLinking
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
