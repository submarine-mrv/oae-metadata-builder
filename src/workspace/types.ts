import type { DatasetRecord, DraftProject, ExperimentRecord } from "@/types/forms";

/** Everything one project owns. The legacy single-session autosave stored this plus `savedAt`. */
export interface ProjectState {
  projectData: DraftProject;
  experiments: ExperimentRecord[];
  datasets: DatasetRecord[];
  nextExperimentId: number;
  nextDatasetId: number;
}

/** Bump when draft-state migrations change the persisted shape or meaning. */
export const PROJECT_SCHEMA_VERSION = 1;

export interface ProjectRecord {
  /** Absent on drafts saved before version protection; interpreted as version 1. */
  schemaVersion?: number;
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

/** The Project Name field, or a placeholder. Never stored. */
export function projectDisplayName(state: ProjectState): string {
  // Imported JSON isn't type-checked, so the field may not be a string.
  const name: unknown = state.projectData.name;
  return typeof name === "string" ? name.trim() || UNNAMED_PROJECT : UNNAMED_PROJECT;
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
  return {
    id: crypto.randomUUID(),
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    state,
  };
}
