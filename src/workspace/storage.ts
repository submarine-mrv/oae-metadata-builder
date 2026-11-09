import { migrateDataset, migrateExperiment, migrateProject } from "@/utils/migrations";
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function isProjectRecord(value: unknown): value is ProjectRecord {
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

function migrateEntityList<T extends { formData: Record<string, unknown> }>(
  entities: T[],
  migrate: (data: T["formData"]) => T["formData"],
): T[] {
  let changed = false;
  const next = entities.map((entity) => {
    const formData = migrate(entity.formData);
    if (formData === entity.formData) return entity;
    changed = true;
    return { ...entity, formData };
  });
  return changed ? next : entities;
}

/** Migrates a stored project's project, experiments and datasets; the same record when nothing changed. */
function migrateProjectRecord(record: ProjectRecord): ProjectRecord {
  const { state } = record;
  const projectData = migrateProject(state.projectData);
  const experiments = migrateEntityList(state.experiments, migrateExperiment);
  const datasets = migrateEntityList(state.datasets, migrateDataset);
  if (
    projectData === state.projectData &&
    experiments === state.experiments &&
    datasets === state.datasets
  ) {
    return record;
  }
  return { ...record, state: { ...state, projectData, experiments, datasets } };
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

  const readable = stored.projects.filter(isProjectRecord);
  const dropped = readable.length < stored.projects.length;
  // Migrate every project, not just the active one, so the project list shows current fields.
  const projects = readable.map(migrateProjectRecord);
  const migrated = projects.some((p, i) => p !== readable[i]);
  const activeProjectId = projects.some((p) => p.id === stored.activeProjectId)
    ? (stored.activeProjectId as string)
    : stored.activeProjectId === null
      ? null
      : (mostRecent(projects)?.id ?? null);
  const workspace: Workspace = { version: 1, activeProjectId, projects };

  const backedUp = dropped && backup(raw);
  quarantined = dropped && !backedUp ? stored.projects.filter((p) => !isProjectRecord(p)) : [];
  const repaired = dropped || migrated || activeProjectId !== stored.activeProjectId;
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
    const session = legacyRaw ? migrateLegacySession(parseJson(legacyRaw)) : null;
    const legacy = session && migrateProjectRecord(session);
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

export interface LocalProjectSource {
  project: ProjectRecord;
  remove(): void;
}

/** Inspect migration sources without repairing, backing up, or rewriting guest storage. */
export function readLocalProjectSources(): LocalProjectSource[] {
  const raw = localStorage.getItem(WORKSPACE_KEY);
  if (raw !== null) {
    const stored: unknown = parseJson(raw);
    if (!isRecord(stored) || stored.version !== 1 || !Array.isArray(stored.projects)) {
      throw new Error("The local project storage could not be read. Its copy was retained.");
    }
    return stored.projects.filter(isProjectRecord).map((original) => ({
      project: migrateProjectRecord(original),
      remove() {
        const latestRaw = localStorage.getItem(WORKSPACE_KEY);
        if (latestRaw === null) return;
        const latest: unknown = parseJson(latestRaw);
        if (!isRecord(latest) || latest.version !== 1 || !Array.isArray(latest.projects)) {
          throw new Error(
            "The local workspace changed format during migration. Its copy was retained.",
          );
        }
        const current = latest.projects.find(
          (candidate) => isRecord(candidate) && candidate.id === original.id,
        );
        if (!current) return;
        if (JSON.stringify(current) !== JSON.stringify(original)) {
          throw new Error("A local project changed during migration. Its local copy was retained.");
        }
        const projects = latest.projects.filter((candidate) => candidate !== current);
        const activeProjectId =
          latest.activeProjectId === original.id
            ? (projects.find(isProjectRecord)?.id ?? null)
            : latest.activeProjectId;
        localStorage.setItem(
          WORKSPACE_KEY,
          JSON.stringify({ ...latest, projects, activeProjectId }),
        );
      },
    }));
  }
  const legacyRaw = localStorage.getItem(LEGACY_SESSION_KEY);
  if (legacyRaw === null) return [];
  const legacy = migrateLegacySession(parseJson(legacyRaw));
  if (!legacy) throw new Error("The local saved project could not be read. Its copy was retained.");
  return [
    {
      // Stable across retries without writing a new envelope before consent.
      project: migrateProjectRecord({ ...legacy, id: `local-session-${legacy.createdAt}` }),
      remove() {
        const current = localStorage.getItem(LEGACY_SESSION_KEY);
        if (current === null) return;
        if (current !== legacyRaw) {
          throw new Error("A local project changed during migration. Its local copy was retained.");
        }
        localStorage.removeItem(LEGACY_SESSION_KEY);
      },
    },
  ];
}
