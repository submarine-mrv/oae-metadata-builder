"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import {
  ProjectFormData,
  ExperimentData,
  ExperimentFormData
} from "@/types/forms";

export interface AppState {
  projectData: ProjectFormData;
  experiments: ExperimentData[];
  activeTab: "overview" | "project" | "experiment";
  activeExperimentId: number | null; // Changed to number
  nextExperimentId: number; // Auto-incrementing counter
  triggerValidation: boolean; // Flag to trigger form validation
}

interface AppStateContextType {
  state: AppState;
  updateProjectData: (data: ProjectFormData) => void;
  addExperiment: (name?: string) => number;
  updateExperiment: (id: number, data: Partial<ExperimentFormData>) => void;
  deleteExperiment: (id: number) => void;
  setActiveTab: (tab: "overview" | "project" | "experiment") => void;
  setActiveExperiment: (id: number | null) => void;
  getExperiment: (id: number) => ExperimentData | undefined;
  getProjectCompletionPercentage: () => number;
  getExperimentCompletionPercentage: (id: number) => number;
  importAllData: (projectData: ProjectFormData, experiments: ExperimentData[]) => void;
  setTriggerValidation: (trigger: boolean) => void;
}

// Re-export types from forms for backward compatibility
export type { ExperimentData, ProjectFormData, ExperimentFormData } from "@/types/forms";

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
            experiment_id: "",
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

  const updateExperiment = useCallback((id: number, data: Partial<ExperimentFormData>) => {
    setState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((exp) =>
        exp.id === id
          ? {
              ...exp,
              formData: { ...exp.formData, ...data },
              experiment_type: data.experiment_type || exp.experiment_type,
              name: (data as Record<string, unknown>).name as string || exp.name,
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

  // Calculate completion percentage based on filled required fields
  const calculateCompletionPercentage = useCallback(
    (data: Record<string, unknown>, requiredFields: string[]): number => {
      if (!data || Object.keys(data).length === 0) return 0;

      let filledFields = 0;
      requiredFields.forEach((field) => {
        const value = data[field];
        if (value !== undefined && value !== null && value !== "") {
          if (Array.isArray(value) && value.length > 0) filledFields++;
          else if (typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0)
            filledFields++;
          else if (typeof value === "string" && value.trim() !== "")
            filledFields++;
          else if (typeof value === "number") filledFields++;
        }
      });

      return Math.round((filledFields / requiredFields.length) * 100);
    },
    []
  );

  const getProjectCompletionPercentage = useCallback(() => {
    // Key required fields for project
    const requiredFields = [
      "project_id",
      "project_description",
      "mcdr_pathway",
      "sea_names",
      "spatial_coverage",
      "temporal_coverage"
    ];
    return calculateCompletionPercentage(state.projectData as unknown as Record<string, unknown>, requiredFields);
  }, [state.projectData, calculateCompletionPercentage]);

  const getExperimentCompletionPercentage = useCallback(
    (id: number) => {
      const experiment = state.experiments.find((exp) => exp.id === id);
      if (!experiment) return 0;

      // Base experiment required fields
      let requiredFields = [
        "experiment_id",
        "experiment_type",
        "description",
        "spatial_coverage",
        "vertical_coverage",
        "investigators",
        "start_datetime",
        "end_datetime"
      ];

      // If it's an intervention, add intervention-specific required fields
      if (experiment.experiment_type === "intervention") {
        requiredFields = [
          ...requiredFields,
          "alkalinity_feedstock_processing",
          "alkalinity_feedstock_form",
          "alkalinity_feedstock",
          "alkalinity_feedstock_description",
          "equilibration",
          "dosing_location",
          "dosing_dispersal_hydrologic_location",
          "dosing_delivery_type",
          "alkalinity_dosing_effluent_density",
          "dosing_depth",
          "dosing_description",
          "dosing_regimen",
          "dosing_data"
        ];
      }

      return calculateCompletionPercentage(experiment.formData as unknown as Record<string, unknown>, requiredFields);
    },
    [state.experiments, calculateCompletionPercentage]
  );

  // Import all data (project + experiments) from imported file
  const importAllData = useCallback(
    (projectData: ProjectFormData, experiments: ExperimentData[]) => {
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
