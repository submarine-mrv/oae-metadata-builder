import type { DatasetRecord, DraftProject, ExperimentRecord } from "@/types/forms";

/** Everything one project owns. Same shape the single-session autosave used. */
export interface ProjectState {
  projectData: DraftProject;
  experiments: ExperimentRecord[];
  datasets: DatasetRecord[];
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
  /** Null only when `projects` is empty. */
  activeProjectId: string | null;
  projects: ProjectRecord[];
}

export const UNNAMED_PROJECT = "Unnamed Project";

/** The Research Project field, or a placeholder. Never stored. */
export function projectDisplayName(state: ProjectState): string {
  return state.projectData.research_project?.trim() || UNNAMED_PROJECT;
}

const APP_TITLE = "OAE Metadata Builder";

/** Browser tab title: the product name, led by the project name once it has one. */
export function documentTitle(state: ProjectState): string {
  const name = projectDisplayName(state);
  return name === UNNAMED_PROJECT ? APP_TITLE : `${name} · ${APP_TITLE}`;
}

export function emptyProjectState(): ProjectState {
  return {
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
