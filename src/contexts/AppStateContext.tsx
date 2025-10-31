"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

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
      const id = state.nextExperimentId;
      const defaultName = name || `Experiment ${id}`;

      const newExperiment: ExperimentData = {
        id,
        name: defaultName,
        formData: {
          project_id: state.projectData?.project_id || ""
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      setState((prev) => ({
        ...prev,
        experiments: [...prev.experiments, newExperiment],
        activeExperimentId: id,
        nextExperimentId: prev.nextExperimentId + 1
      }));

      return id;
    },
    [state.projectData, state.nextExperimentId]
  );

  const updateExperiment = useCallback((id: number, data: any) => {
    setState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((exp) =>
        exp.id === id
          ? {
              ...exp,
              formData: data,
              experiment_type: data.experiment_type,
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

  // Calculate completion percentage based on filled required fields
  const calculateCompletionPercentage = useCallback(
    (data: any, requiredFields: string[]): number => {
      if (!data || Object.keys(data).length === 0) return 0;

      let filledFields = 0;
      requiredFields.forEach((field) => {
        const value = data[field];
        if (value !== undefined && value !== null && value !== "") {
          if (Array.isArray(value) && value.length > 0) filledFields++;
          else if (typeof value === "object" && Object.keys(value).length > 0)
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
    return calculateCompletionPercentage(state.projectData, requiredFields);
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

      return calculateCompletionPercentage(experiment.formData, requiredFields);
    },
    [state.experiments, calculateCompletionPercentage]
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
