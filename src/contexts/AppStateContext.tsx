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
  AppFormState
} from "@/types/forms";

// Re-export types for backward compatibility
export type ExperimentData = ExperimentState;
export type DatasetData = DatasetState;

export type AppState = AppFormState;

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
    datasets: DatasetFormData[]
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
    setState((prev) => ({
      ...prev,
      projectData: data
    }));
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
      setState((prev) => ({
        ...prev,
        experiments: prev.experiments.map((exp) =>
          exp.id === id
            ? {
                ...exp,
                formData: { ...exp.formData, ...data } as ExperimentFormData,
                experiment_type: data.experiment_type || exp.experiment_type,
                name: data.name || exp.name,
                updatedAt: Date.now()
              }
            : exp
        )
      }));
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
  const importSelectedData = useCallback(
    (
      projectData: ProjectFormData | null,
      experiments: ExperimentFormData[],
      datasets: DatasetFormData[]
    ) => {
      setState((prev) => {
        // Handle project - simply replace if provided
        const newProjectData = projectData
          ? { ...prev.projectData, ...projectData }
          : prev.projectData;

        // Handle experiments - replace matching or add new
        const newExperiments = [...prev.experiments];
        let nextExpId = prev.nextExperimentId;

        for (const expData of experiments) {
          const expId = expData.experiment_id as string | undefined;
          const expName = (expData.name as string) || expId;

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
          } else {
            // Add as new experiment
            newExperiments.push({
              id: nextExpId,
              name: expName || `Experiment ${nextExpId}`,
              formData: expData,
              experiment_type: expData.experiment_type,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
            nextExpId++;
          }
        }

        // Handle datasets - replace matching or add new
        const newDatasets = [...prev.datasets];
        let nextDsId = prev.nextDatasetId;

        for (const dsData of datasets) {
          const dsName = dsData.name as string | undefined;

          // Find existing dataset by name
          const existingIndex = dsName
            ? newDatasets.findIndex((d) => d.name === dsName)
            : -1;

          if (existingIndex >= 0) {
            // Replace existing dataset
            newDatasets[existingIndex] = {
              ...newDatasets[existingIndex],
              formData: dsData,
              name: dsName || newDatasets[existingIndex].name,
              updatedAt: Date.now()
            };
          } else {
            // Add as new dataset
            newDatasets.push({
              id: nextDsId,
              name: dsName || `Dataset ${nextDsId}`,
              formData: dsData,
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
    getDataset
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
