"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const AUTOSAVE_KEY = "oae-metadata-autosave";

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

interface SavedSession {
  projectData: any;
  experiments: ExperimentData[];
  nextExperimentId: number;
  savedAt: number;
  projectName: string;
  experimentNames: string[];
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
  getSavedSession: () => SavedSession | null;
  restoreSession: () => void;
  clearSavedSession: () => void;
  shouldShowRestoreModal: boolean;
  dismissRestoreModal: () => void;
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

  const [shouldShowRestoreModal, setShouldShowRestoreModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for saved session on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedData = localStorage.getItem(AUTOSAVE_KEY);
    if (savedData) {
      try {
        const session: SavedSession = JSON.parse(savedData);
        // Only show restore modal if there's meaningful data
        const hasProjectData = session.projectData && Object.keys(session.projectData).length > 1; // More than just empty project_id
        const hasExperiments = session.experiments && session.experiments.length > 0;

        if (hasProjectData || hasExperiments) {
          setShouldShowRestoreModal(true);
        }
      } catch (error) {
        console.error("Failed to parse saved session:", error);
        localStorage.removeItem(AUTOSAVE_KEY);
      }
    }
    setIsInitialized(true);
  }, []);

  // Auto-save state changes (but not on initial render)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window === "undefined") return;

    // Don't auto-save if state is empty/default
    const hasProjectData = state.projectData && Object.keys(state.projectData).length > 1;
    const hasExperiments = state.experiments.length > 0;

    if (!hasProjectData && !hasExperiments) {
      return;
    }

    const session: SavedSession = {
      projectData: state.projectData,
      experiments: state.experiments,
      nextExperimentId: state.nextExperimentId,
      savedAt: Date.now(),
      projectName: state.projectData?.project_id || "",
      experimentNames: state.experiments.map(exp => exp.name)
    };

    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  }, [state.projectData, state.experiments, state.nextExperimentId, isInitialized]);

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

      // Clear saved session when importing new data
      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTOSAVE_KEY);
      }
      setShouldShowRestoreModal(false);
    },
    [state.nextExperimentId]
  );

  const setTriggerValidation = useCallback((trigger: boolean) => {
    setState((prev) => ({
      ...prev,
      triggerValidation: trigger
    }));
  }, []);

  const getSavedSession = useCallback((): SavedSession | null => {
    if (typeof window === "undefined") return null;

    const savedData = localStorage.getItem(AUTOSAVE_KEY);
    if (!savedData) return null;

    try {
      return JSON.parse(savedData);
    } catch (error) {
      console.error("Failed to parse saved session:", error);
      return null;
    }
  }, []);

  const restoreSession = useCallback(() => {
    const session = getSavedSession();
    if (!session) return;

    setState({
      projectData: session.projectData,
      experiments: session.experiments,
      activeTab: "overview",
      activeExperimentId: null,
      nextExperimentId: session.nextExperimentId,
      triggerValidation: false
    });

    setShouldShowRestoreModal(false);
  }, [getSavedSession]);

  const clearSavedSession = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(AUTOSAVE_KEY);
    setShouldShowRestoreModal(false);
  }, []);

  const dismissRestoreModal = useCallback(() => {
    setShouldShowRestoreModal(false);
    clearSavedSession();
  }, [clearSavedSession]);

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
    setTriggerValidation,
    getSavedSession,
    restoreSession,
    clearSavedSession,
    shouldShowRestoreModal,
    dismissRestoreModal
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
