import type { DatasetState, DraftProject, ExperimentState } from "@/types/forms";

/** Everything one project owns. Same shape the single-session autosave used. */
export interface ProjectState {
  hasProject: boolean;
  projectData: DraftProject;
  experiments: ExperimentState[];
  datasets: DatasetState[];
  nextExperimentId: number;
  nextDatasetId: number;
}

export interface ProjectRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: ProjectState;
}

export interface Workspace {
  version: 1;
  activeProjectId: string;
  projects: ProjectRecord[];
}

export const UNNAMED_PROJECT = "Unnamed Project";

/** The Research Project name, or a placeholder. Never stored. */
export function projectDisplayName(state: ProjectState): string {
  return state.projectData.name?.trim() || UNNAMED_PROJECT;
}

export function emptyProjectState(): ProjectState {
  return {
    hasProject: false,
    projectData: { project_id: "" },
    experiments: [],
    datasets: [],
    nextExperimentId: 1,
    nextDatasetId: 1,
  };
}

export function newProjectRecord(
  state: ProjectState = emptyProjectState(),
  now: number = Date.now(),
): ProjectRecord {
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, state };
}
