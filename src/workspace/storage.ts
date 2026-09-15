import { newProjectRecord, type ProjectRecord, type ProjectState, type Workspace } from "./types";

export const WORKSPACE_KEY = "oae-metadata-builder-workspace";
/** Pre-workspace single-session autosave. Read once, then removed. */
export const LEGACY_SESSION_KEY = "oae-metadata-builder-session";

/** The seam a cloud-backed implementation replaces. */
export interface WorkspaceStore {
  load(): Workspace | null;
  save(workspace: Workspace): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProjectState(value: unknown): value is ProjectState {
  if (!isRecord(value)) return false;
  return (
    typeof value.hasProject === "boolean" &&
    isRecord(value.projectData) &&
    Array.isArray(value.experiments) &&
    Array.isArray(value.datasets) &&
    typeof value.nextExperimentId === "number" &&
    typeof value.nextDatasetId === "number"
  );
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    isProjectState(value.state)
  );
}

export function isWorkspace(value: unknown): value is Workspace {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    typeof value.activeProjectId === "string" &&
    Array.isArray(value.projects) &&
    value.projects.length > 0 &&
    value.projects.every(isProjectRecord)
  );
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to clean up.
  }
}

/** Wraps a legacy saved session as a project record, or null if it isn't one. */
export function migrateLegacySession(raw: unknown): ProjectRecord | null {
  if (!isRecord(raw) || typeof raw.savedAt !== "number" || !isProjectState(raw)) return null;
  const { savedAt, ...state } = raw as ProjectState & { savedAt: number };
  return newProjectRecord(state, savedAt);
}

export const localStorageWorkspaceStore: WorkspaceStore = {
  load() {
    const stored = readJson(WORKSPACE_KEY);
    if (stored !== null) {
      if (isWorkspace(stored)) return stored;
      remove(WORKSPACE_KEY);
    }

    const legacy = migrateLegacySession(readJson(LEGACY_SESSION_KEY));
    if (!legacy) return null;
    const workspace: Workspace = { version: 1, activeProjectId: legacy.id, projects: [legacy] };
    this.save(workspace);
    remove(LEGACY_SESSION_KEY);
    return workspace;
  },

  save(workspace) {
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    } catch {
      // Quota or unavailable storage; the in-memory workspace keeps working.
    }
  },
};
