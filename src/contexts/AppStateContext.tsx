import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type {
  AppFormState,
  DatasetLinkingMetadata,
  DatasetRecord,
  DraftDataset,
  DraftExperiment,
  DraftProject,
  ExperimentRecord,
} from "@/types/forms";
import { computeCompletion } from "@/utils/completionCalculator";
import { cleanFormData } from "@/utils/formDataCleanup";
import { propagateExperimentIdToDatasets } from "@/utils/idPropagation";
import { validateDataset, validateExperiment, validateProject } from "@/utils/validation";

export type AppState = AppFormState;

import * as reducers from "@/state/projectReducers";
import type { ImportSelection } from "@/utils/applyImport";
import { parseProjectState } from "@/utils/parseProjectState";
import { emptyProjectState, type ProjectState } from "@/workspace/types";

function mergeExperiment(
  state: ProjectState,
  id: number,
  data: Partial<DraftExperiment> & { name?: string },
): ProjectState {
  const oldExpId = state.experiments.find((exp) => exp.id === id)?.formData?.experiment_id;
  const newExpId = data.experiment_id;

  const experiments = state.experiments.map((exp) =>
    exp.id === id
      ? {
          ...exp,
          formData: cleanFormData({ ...exp.formData, ...data }) as DraftExperiment,
          name: data.name || exp.name,
          updatedAt: Date.now(),
        }
      : exp,
  );

  // When RJSF clears a field, experiment_id may be undefined in `data`, so detect a clear by key presence.
  const expIdChanged = "experiment_id" in data && newExpId !== oldExpId;
  const datasets = expIdChanged
    ? propagateExperimentIdToDatasets(state.datasets, id, (newExpId as string) || undefined)
    : state.datasets;

  return { ...state, experiments, datasets };
}

function mergeDataset(
  state: ProjectState,
  id: number,
  data: Partial<DraftDataset> & { name?: string },
): ProjectState {
  return {
    ...state,
    datasets: state.datasets.map((ds) =>
      ds.id === id
        ? {
            ...ds,
            formData: { ...ds.formData, ...data } as DraftDataset,
            name: data.name || ds.name,
            updatedAt: Date.now(),
          }
        : ds,
    ),
  };
}

interface AppStateContextType {
  state: AppState;
  updateProjectData: (data: DraftProject) => void;
  addExperiment: (name?: string) => number;
  updateExperiment: (id: number, data: Partial<DraftExperiment> & { name?: string }) => void;
  /**
   * Full replacement of an experiment's formData. Use this from the
   * experiment form page where the incoming payload is authoritative —
   * unlike `updateExperiment` which merges into existing formData and
   * therefore cannot distinguish "user cleared this field" from "user
   * didn't touch this field" once `cleanFormData` has stripped the key.
   */
  replaceExperimentFormData: (id: number, data: DraftExperiment) => void;
  deleteExperiment: (id: number) => void;
  /** Duplicate an experiment, appending " (Copy)" to its name. Returns the new ID. */
  duplicateExperiment: (id: number) => number;
  setActiveExperiment: (id: number | null) => void;
  getExperiment: (id: number) => ExperimentRecord | undefined;
  getProjectCompletionPercentage: () => number;
  getExperimentCompletionPercentage: (id: number) => number;
  getDatasetCompletionPercentage: (id: number) => number;
  /** Live status (percentage + validity) — one AJV run per call. */
  getProjectStatus: () => { percentage: number; isValid: boolean; isEmpty: boolean };
  getExperimentStatus: (id: number) => { percentage: number; isValid: boolean; isEmpty: boolean };
  getDatasetStatus: (id: number) => { percentage: number; isValid: boolean; isEmpty: boolean };
  /** Merge an import selection into the open project. */
  importSelectedData: (
    projectData: DraftProject | null,
    experiments: DraftExperiment[],
    datasets: ImportSelection["datasets"],
  ) => void;
  setTriggerValidation: (trigger: boolean) => void;
  setShowJsonPreview: (show: boolean) => void;
  toggleJsonPreview: () => void;
  // Dataset methods
  addDataset: (name?: string) => number;
  updateDataset: (id: number, data: Partial<DraftDataset> & { name?: string }) => void;
  replaceDatasetFormData: (id: number, data: DraftDataset) => void;
  deleteDataset: (id: number) => void;
  /** Duplicate a dataset, appending " (Copy)" to its name. Returns the new ID. */
  duplicateDataset: (id: number) => number;
  setActiveDataset: (id: number | null) => void;
  getDataset: (id: number) => DatasetRecord | undefined;
  // ID Linking methods
  updateDatasetLinking: (id: number, linking: Partial<DatasetLinkingMetadata>) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

interface AppStateProviderProps {
  children: React.ReactNode;
  /** Saved project to edit. Parsed at the boundary on mount. */
  initialState?: ProjectState;
  /** Fired after any change to the persisted subset of state. */
  onChange?: (state: ProjectState) => void;
}

const UI_INITIAL_STATE = {
  activeExperimentId: null,
  activeDatasetId: null,
  triggerValidation: false,
  showJsonPreview: false,
};

const PROJECT_STATE_KEYS = [
  "projectData",
  "experiments",
  "datasets",
  "nextExperimentId",
  "nextDatasetId",
] as const satisfies readonly (keyof ProjectState)[];

// Fails to compile if ProjectState gains a key missing from PROJECT_STATE_KEYS.
type _AllKeysListed = AssertNever<Exclude<keyof ProjectState, (typeof PROJECT_STATE_KEYS)[number]>>;
type AssertNever<T extends never> = T;

function persistedSubset(state: AppState): ProjectState {
  const subset = {} as Record<keyof ProjectState, unknown>;
  for (const key of PROJECT_STATE_KEYS) subset[key] = state[key];
  return subset as ProjectState;
}

function sameProjectState(a: ProjectState, b: ProjectState): boolean {
  return PROJECT_STATE_KEYS.every((key) => a[key] === b[key]);
}

/** Merge a reducer's result into the full state; an unchanged result keeps the same object. */
function withProject(prev: AppState, next: ProjectState): AppState {
  return next === prev ? prev : { ...prev, ...next };
}

export function AppStateProvider({ children, initialState, onChange }: AppStateProviderProps) {
  const [state, setState] = useState<AppState>(() => {
    const project = initialState ? parseProjectState(initialState) : emptyProjectState();
    return {
      ...UI_INITIAL_STATE,
      ...project,
      activeExperimentId: project.experiments[0]?.id ?? null,
      activeDatasetId: project.datasets[0]?.id ?? null,
    };
  });

  // Report persisted changes to the owner without re-subscribing on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastReported = useRef(persistedSubset(state));
  useEffect(() => {
    const current = persistedSubset(state);
    if (sameProjectState(current, lastReported.current)) return;
    lastReported.current = current;
    onChangeRef.current?.(current);
  }, [state]);

  const updateProjectData = useCallback((data: DraftProject) => {
    setState((prev) => withProject(prev, reducers.updateProjectData(prev, data)));
  }, []);

  const addExperiment = useCallback((name?: string): number => {
    const idRef = { current: 0 };
    setState((prev) => {
      const { state, id } = reducers.addExperiment(prev, name);
      idRef.current = id;
      return { ...prev, ...state, activeExperimentId: id };
    });
    return idRef.current;
  }, []);

  const updateExperiment = useCallback(
    (id: number, data: Partial<DraftExperiment> & { name?: string }) => {
      setState((prev) => withProject(prev, mergeExperiment(prev, id, data)));
    },
    [],
  );

  const replaceExperimentFormData = useCallback((id: number, data: DraftExperiment) => {
    setState((prev) => withProject(prev, reducers.replaceExperimentFormData(prev, id, data)));
  }, []);

  const deleteExperiment = useCallback((id: number) => {
    setState((prev) => ({
      ...prev,
      ...reducers.deleteExperiment(prev, id),
      activeExperimentId: prev.activeExperimentId === id ? null : prev.activeExperimentId,
    }));
  }, []);

  const duplicateExperiment = useCallback((id: number): number => {
    const idRef = { current: 0 };
    setState((prev) => {
      const { state, id: newId } = reducers.duplicateExperiment(prev, id);
      idRef.current = newId;
      return withProject(prev, state);
    });
    return idRef.current;
  }, []);

  const setActiveExperiment = useCallback((id: number | null) => {
    setState((prev) => ({
      ...prev,
      activeExperimentId: id,
    }));
  }, []);

  const getExperiment = useCallback(
    (id: number) => {
      return state.experiments.find((exp) => exp.id === id);
    },
    [state.experiments],
  );

  // Full live status — single AJV run, returns percentage + validity.
  // The legacy getXCompletionPercentage wrappers below delegate here so
  // there's exactly one code path for progress/validity derivation.
  const getProjectStatus = useCallback(() => {
    const data = state.projectData;
    const isEmpty = !data || Object.keys(data).length === 0;
    if (isEmpty) return { percentage: 0, isValid: false, isEmpty: true };
    // Trust the validator's isValid (covers its exception path where
    // it returns {isValid: false, errors: []}).
    const { errors, isValid } = validateProject(data);
    const { percentage } = computeCompletion(data, errors);
    return { percentage, isValid, isEmpty: false };
  }, [state.projectData]);

  const getExperimentStatus = useCallback(
    (id: number) => {
      const experiment = state.experiments.find((exp) => exp.id === id);
      if (!experiment) return { percentage: 0, isValid: false, isEmpty: true };
      const data = experiment.formData;
      const isEmpty = !data || Object.keys(data).length === 0;
      if (isEmpty) return { percentage: 0, isValid: false, isEmpty: true };
      const { errors, isValid } = validateExperiment(data);
      const { percentage } = computeCompletion(data, errors);
      return { percentage, isValid, isEmpty: false };
    },
    [state.experiments],
  );

  const getDatasetStatus = useCallback(
    (id: number) => {
      const dataset = state.datasets.find((ds) => ds.id === id);
      if (!dataset) return { percentage: 0, isValid: false, isEmpty: true };
      const data = dataset.formData;
      const isEmpty = !data || Object.keys(data).length === 0;
      if (isEmpty) return { percentage: 0, isValid: false, isEmpty: true };
      const hasExperiments = state.experiments.length > 0;
      const { errors, isValid } = validateDataset(data, { hasExperiments });
      const { percentage } = computeCompletion(data, errors);
      return { percentage, isValid, isEmpty: false };
    },
    [state.datasets, state.experiments],
  );

  const getProjectCompletionPercentage = useCallback(
    () => getProjectStatus().percentage,
    [getProjectStatus],
  );
  const getExperimentCompletionPercentage = useCallback(
    (id: number) => getExperimentStatus(id).percentage,
    [getExperimentStatus],
  );
  const getDatasetCompletionPercentage = useCallback(
    (id: number) => getDatasetStatus(id).percentage,
    [getDatasetStatus],
  );

  // =============================================================================
  // Dataset Methods
  // =============================================================================

  const addDataset = useCallback((name?: string): number => {
    const idRef = { current: 0 };
    setState((prev) => {
      const { state, id } = reducers.addDataset(prev, name);
      idRef.current = id;
      return { ...prev, ...state, activeDatasetId: id };
    });
    return idRef.current;
  }, []);

  const updateDataset = useCallback(
    (id: number, data: Partial<DraftDataset> & { name?: string }) => {
      setState((prev) => withProject(prev, mergeDataset(prev, id, data)));
    },
    [],
  );

  const replaceDatasetFormData = useCallback((id: number, data: DraftDataset) => {
    setState((prev) => withProject(prev, reducers.replaceDatasetFormData(prev, id, data)));
  }, []);

  const deleteDataset = useCallback((id: number) => {
    setState((prev) => ({
      ...prev,
      ...reducers.deleteDataset(prev, id),
      activeDatasetId: prev.activeDatasetId === id ? null : prev.activeDatasetId,
    }));
  }, []);

  const duplicateDataset = useCallback((id: number): number => {
    const idRef = { current: 0 };
    setState((prev) => {
      const { state, id: newId } = reducers.duplicateDataset(prev, id);
      idRef.current = newId;
      return withProject(prev, state);
    });
    return idRef.current;
  }, []);

  const setActiveDataset = useCallback((id: number | null) => {
    setState((prev) => ({
      ...prev,
      activeDatasetId: id,
    }));
  }, []);

  const getDataset = useCallback(
    (id: number) => {
      return state.datasets.find((ds) => ds.id === id);
    },
    [state.datasets],
  );

  const updateDatasetLinking = useCallback(
    (id: number, linking: Partial<DatasetLinkingMetadata>) => {
      setState((prev) => withProject(prev, reducers.updateDatasetLinking(prev, id, linking)));
    },
    [],
  );

  const importSelectedData = useCallback(
    (
      projectData: DraftProject | null,
      experiments: DraftExperiment[],
      datasets: ImportSelection["datasets"],
    ) => {
      setState((prev) =>
        withProject(
          prev,
          reducers.importSelection(prev, { project: projectData, experiments, datasets }),
        ),
      );
    },
    [],
  );

  const setTriggerValidation = useCallback((trigger: boolean) => {
    setState((prev) => ({
      ...prev,
      triggerValidation: trigger,
    }));
  }, []);

  const setShowJsonPreview = useCallback((show: boolean) => {
    setState((prev) => ({
      ...prev,
      showJsonPreview: show,
    }));
  }, []);

  const toggleJsonPreview = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showJsonPreview: !prev.showJsonPreview,
    }));
  }, []);

  const value: AppStateContextType = {
    state,
    updateProjectData,
    addExperiment,
    updateExperiment,
    replaceExperimentFormData,
    deleteExperiment,
    duplicateExperiment,
    setActiveExperiment,
    getExperiment,
    getProjectCompletionPercentage,
    getExperimentCompletionPercentage,
    getDatasetCompletionPercentage,
    getProjectStatus,
    getExperimentStatus,
    getDatasetStatus,
    importSelectedData,
    setTriggerValidation,
    setShowJsonPreview,
    toggleJsonPreview,
    // Dataset methods
    addDataset,
    updateDataset,
    replaceDatasetFormData,
    deleteDataset,
    duplicateDataset,
    setActiveDataset,
    getDataset,
    // ID Linking methods
    updateDatasetLinking,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
