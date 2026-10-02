import { newProjectRecord, type ProjectRecord, type ProjectState, type Workspace } from "./types";
import { mostRecent } from "./workspace";

export const WORKSPACE_KEY = "oae-metadata-builder-workspace";
/** Pre-workspace single-session autosave. Read once, then removed. */
export const LEGACY_SESSION_KEY = "oae-metadata-builder-session";
/** Unreadable workspace data is copied here, suffixed with a timestamp. */
export const BACKUP_KEY_PREFIX = `${WORKSPACE_KEY}-backup-`;

/** The seam a cloud-backed implementation replaces. */
export interface WorkspaceStore {
  load(): Workspace | null;
  save(workspace: Workspace): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEntity(value: unknown): boolean {
  return isRecord(value) && isRecord(value.formData);
}

function isProjectState(value: unknown): value is ProjectState {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.projectData) &&
    Array.isArray(value.experiments) &&
    value.experiments.every(isEntity) &&
    Array.isArray(value.datasets) &&
    value.datasets.every(isEntity) &&
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

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Quota or unavailable storage.
    return false;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to clean up.
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function backup(raw: string): boolean {
  return write(`${BACKUP_KEY_PREFIX}${Date.now()}`, raw);
}

/** Unreadable project records whose backup failed; saves keep them so they aren't lost. */
let quarantined: unknown[] = [];

/**
 * Keeps every readable project and repairs the active id. Null when the
 * envelope itself can't be read.
 */
function readWorkspace(raw: string): Workspace | null {
  const stored = parseJson(raw);
  if (!isRecord(stored) || stored.version !== 1 || !Array.isArray(stored.projects)) return null;

  const projects = stored.projects.filter(isProjectRecord);
  const dropped = projects.length < stored.projects.length;
  const activeProjectId = projects.some((p) => p.id === stored.activeProjectId)
    ? (stored.activeProjectId as string)
    : (mostRecent(projects)?.id ?? null);
  const workspace: Workspace = { version: 1, activeProjectId, projects };

  const backedUp = dropped && backup(raw);
  quarantined = dropped && !backedUp ? stored.projects.filter((p) => !isProjectRecord(p)) : [];
  const repaired = dropped || activeProjectId !== stored.activeProjectId;
  // Overwrite only once any dropped records are backed up.
  if (repaired && (!dropped || backedUp)) write(WORKSPACE_KEY, JSON.stringify(workspace));
  return workspace;
}

type LegacySession = ProjectState & { savedAt: number; hasProject?: boolean };

/** Wraps a legacy saved session as a project record, or null if it isn't one. */
function migrateLegacySession(raw: unknown): ProjectRecord | null {
  if (!isRecord(raw) || typeof raw.savedAt !== "number" || !isProjectState(raw)) return null;
  // hasProject is a retired field.
  const { savedAt, hasProject: _, ...state } = raw as unknown as LegacySession;
  return newProjectRecord(state, savedAt);
}

export const localStorageWorkspaceStore: WorkspaceStore = {
  load() {
    // Never discard saved user data: drop only what can't be read, and back it up first.
    quarantined = [];
    const raw = read(WORKSPACE_KEY);
    if (raw) {
      const workspace = readWorkspace(raw);
      if (workspace) return workspace;
      // Kept in place if the backup fails; removed otherwise so the next load doesn't back it up again.
      if (!backup(raw)) return null;
      remove(WORKSPACE_KEY);
    }

    const legacyRaw = read(LEGACY_SESSION_KEY);
    const legacy = legacyRaw ? migrateLegacySession(parseJson(legacyRaw)) : null;
    if (!legacy) return null;
    const workspace: Workspace = { version: 1, activeProjectId: legacy.id, projects: [legacy] };
    if (write(WORKSPACE_KEY, JSON.stringify(workspace))) remove(LEGACY_SESSION_KEY);
    return workspace;
  },

  save(workspace) {
    const stored = quarantined.length
      ? { ...workspace, projects: [...workspace.projects, ...quarantined] }
      : workspace;
    write(WORKSPACE_KEY, JSON.stringify(stored));
  },
};
