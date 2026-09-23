// Write-only atoms for every workspace and project action.

import { atom, type WritableAtom } from "jotai";
import { applyImport, type ImportSelection } from "@/utils/applyImport";
import { emptyProjectState, newProjectRecord, type ProjectState } from "@/workspace/types";
import { addProject, deleteProject, switchProject } from "@/workspace/workspace";
import {
  activeDatasetIdAtom,
  activeExperimentIdAtom,
  activeProjectAtom,
  projectStateAtom,
  showJsonPreviewAtom,
  workspaceAtom,
} from "./atoms";
import * as reducers from "./projectReducers";

// =============================================================================
// Helpers
// =============================================================================

/** Adds a project built from the atom's arguments, makes it active and returns its id. */
function newProjectAction<A extends unknown[]>(initialState: (...args: A) => ProjectState) {
  return atom(null, (_get, set, ...args: A): string => {
    const record = newProjectRecord(initialState(...args));
    set(workspaceAtom, (ws) => addProject(ws, record));
    return record.id;
  });
}

/** Applies `reducer` to the active project. Does nothing without one. */
function projectAction<A extends unknown[]>(
  reducer: (state: ProjectState, ...args: A) => ProjectState,
) {
  return atom(null, (_get, set, ...args: A) => {
    set(projectStateAtom, (prev) => reducer(prev, ...args));
  });
}

type SelectionAtom = WritableAtom<number | null, [number | null], void>;

/**
 * Applies a reducer that creates a record and returns the record's id, or 0
 * with no active project. With `select`, the new record is also selected.
 */
function projectActionWithId<A extends unknown[]>(
  reducer: (state: ProjectState, ...args: A) => reducers.WithId,
  select?: SelectionAtom,
) {
  return atom(null, (get, set, ...args: A): number => {
    if (!get(activeProjectAtom)) return 0;
    const { state, id } = reducer(get(projectStateAtom), ...args);
    set(projectStateAtom, state);
    if (id && select) set(select, id);
    return id;
  });
}

// =============================================================================
// Workspace
// =============================================================================

export const createProjectAtom = newProjectAction(emptyProjectState);

export const importAsNewProjectAtom = newProjectAction((selection: ImportSelection) =>
  applyImport(emptyProjectState(), selection),
);

export const switchProjectAtom = atom(null, (_get, set, id: string) => {
  set(workspaceAtom, (ws) => switchProject(ws, id));
});

export const deleteProjectAtom = atom(null, (_get, set, id: string) => {
  set(workspaceAtom, (ws) => deleteProject(ws, id));
});

// =============================================================================
// Active project
// =============================================================================

export const updateProjectDataAtom = projectAction(reducers.updateProjectData);

/** Adds an experiment and selects it. */
export const addExperimentAtom = projectActionWithId(
  reducers.addExperiment,
  activeExperimentIdAtom,
);
export const replaceExperimentFormDataAtom = projectAction(reducers.replaceExperimentFormData);
export const deleteExperimentAtom = projectAction(reducers.deleteExperiment);
export const duplicateExperimentAtom = projectActionWithId(reducers.duplicateExperiment);

/** Adds a dataset and selects it. */
export const addDatasetAtom = projectActionWithId(reducers.addDataset, activeDatasetIdAtom);
export const replaceDatasetFormDataAtom = projectAction(reducers.replaceDatasetFormData);
export const deleteDatasetAtom = projectAction(reducers.deleteDataset);
export const duplicateDatasetAtom = projectActionWithId(reducers.duplicateDataset);
export const updateDatasetLinkingAtom = projectAction(reducers.updateDatasetLinking);

/** Merges an import selection into the active project. */
export const importSelectedDataAtom = projectAction(reducers.importSelection);

// =============================================================================
// UI
// =============================================================================

export const toggleJsonPreviewAtom = atom(null, (_get, set) => {
  set(showJsonPreviewAtom, (show) => !show);
});
