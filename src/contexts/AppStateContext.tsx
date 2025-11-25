"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import {
  calculateFormCompletion,
  calculateProjectCompletion
} from "@/utils/completionCalculator";

export interface ExperimentData {
  id: number; // Internal integer ID for tracking
  name: string;
  formData: any;
  experiment_type?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  projectData: any;
  experiments: ExperimentData[];
  activeTab: "overview" | "project" | "experiment";
  activeExperimentId: number | null; // Changed to number
  nextExperimentId: number; // Auto-incrementing counter
  triggerValidation: boolean; // Flag to trigger form validation
}

interface AppStateContextType {
  state: AppState;
  updateProjectData: (data: any) => void;
  addExperiment: (name?: string) => number;
  updateExperiment: (id: number, data: any) => void;
  deleteExperiment: (id: number) => void;
  setActiveTab: (tab: "overview" | "project" | "experiment") => void;
  setActiveExperiment: (id: number | null) => void;
  getExperiment: (id: number) => ExperimentData | undefined;
  getProjectCompletionPercentage: () => number;
  getExperimentCompletionPercentage: (id: number) => number;
  importAllData: (projectData: any, experiments: ExperimentData[]) => void;
  setTriggerValidation: (trigger: boolean) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(
  undefined
);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    projectData: { project_id: "" },
    experiments: [],
    activeTab: "overview",
    activeExperimentId: null,
    nextExperimentId: 1,
    triggerValidation: false
  });

  const updateProjectData = useCallback((data: any) => {
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

  const updateExperiment = useCallback((id: number, data: any) => {
    setState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((exp) =>
        exp.id === id
          ? {
              ...exp,
              formData: { ...exp.formData, ...data },
              experiment_type: data.experiment_type || exp.experiment_type,
              name: data.name || exp.name,
              updatedAt: Date.now()
            }
          : exp
      )
    }));
  }, []);

  const deleteExperiment = useCallback((id: number) => {
    setState((prev) => ({
      ...prev,
      experiments: prev.experiments.filter((exp) => exp.id !== id),
      activeExperimentId:
        prev.activeExperimentId === id ? null : prev.activeExperimentId
    }));
  }, []);

  const setActiveTab = useCallback(
    (tab: "overview" | "project" | "experiment") => {
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

  // Import all data (project + experiments) from imported file
  const importAllData = useCallback(
    (projectData: any, experiments: ExperimentData[]) => {
      // Reassign experiment IDs to avoid conflicts
      const nextId = state.nextExperimentId;
      const experimentsWithNewIds = experiments.map((exp, index) => ({
        ...exp,
        id: nextId + index
      }));

      setState({
        projectData,
        experiments: experimentsWithNewIds,
        activeTab: "overview",
        activeExperimentId: null,
        nextExperimentId: nextId + experiments.length,
        triggerValidation: false
      });
    },
    [state.nextExperimentId]
  );

  const setTriggerValidation = useCallback((trigger: boolean) => {
    setState((prev) => ({
      ...prev,
      triggerValidation: trigger
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
    setTriggerValidation
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
