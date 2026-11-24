import { atom } from "jotai";
import type { ConflictPreference, SyncConflict } from "./merge";
import { ProjectAccessError, UnsupportedProjectVersionError } from "./projectCloudSync/helper";
import type { ProjectAccess } from "./projectCloudSync/types";

export type ProjectSyncStatus =
  | { state: "disabled" | "loading" | "syncing" | "synced" }
  | { state: "pending"; message: string }
  | { state: "error"; message: string; projectId?: string; noRetry?: true };

export class ProjectConflictError extends Error {
  constructor(
    public readonly projectId: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectConflictError";
  }
}

/** Each conflict's chosen side, by `SyncConflict.key`. */
export type ConflictChoices = Record<string, ConflictPreference>;

/** The conflicts changed after they were shown, so the choices need another look. */
export class ProjectConflictChangedError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly conflicts: SyncConflict[],
  ) {
    super("Changes updated while you were reviewing. Review them again.");
    this.name = "ProjectConflictChangedError";
  }
}

export function projectSyncErrorStatus(error: unknown): ProjectSyncStatus {
  return {
    state: "error",
    message: error instanceof Error ? error.message : "Could not sync this project.",
    ...(error instanceof ProjectConflictError ? { projectId: error.projectId } : {}),
    // Saving again can't settle a conflict or a newer-format project.
    ...(error instanceof ProjectConflictError ||
    error instanceof UnsupportedProjectVersionError ||
    error instanceof ProjectAccessError
      ? { noRetry: true as const }
      : {}),
  };
}

export interface ProjectSyncActions {
  flush(): Promise<void>;
  migrateLocalProjects(): Promise<void>;
  remove(projectId: string): Promise<void>;
  /** Picks up changes made elsewhere; `maxAgeMs` skips it if one ran that recently. */
  refresh(maxAgeMs?: number): Promise<void>;
  keepProjectChanges(projectId: string): Promise<void>;
  discardProjectChanges(projectId: string): Promise<void>;
  /** Loads the latest cloud copy and lists what clashes with this tab. */
  previewProjectConflict(projectId: string): Promise<SyncConflict[]>;
  /**
   * Saves with a side chosen for each of the `reviewed` conflicts. Throws
   * `ProjectConflictChangedError` if they no longer match what is in conflict now.
   */
  resolveProjectConflict(
    projectId: string,
    choices: ConflictChoices,
    reviewed: SyncConflict[],
  ): Promise<void>;
  stop(): void;
}

/** Something removed here because it was deleted elsewhere. The UI shows these, then clears them. */
export interface RemoteDeletion {
  type: "project" | "experiment" | "dataset";
  name: string;
  /** Where it was, so the UI can leave its page. */
  projectId?: string;
  /** Experiments and datasets only. */
  id?: string;
  /** Not deleted for everyone: this user lost access, or can now only view it. */
  reason?: "access" | "viewOnly";
  /** Edits made here since the last save were lost with it. */
  unsavedEdits?: true;
}

export const remoteDeletionsAtom = atom<RemoteDeletion[]>([]);
/** Open editors holding drafts outside the workspace. Background sync waits until none are open. */
export const refreshPausesAtom = atom(0);
/** The signed-in user's access to each cloud project, by project ID. */
export const projectAccessAtom = atom<Record<string, ProjectAccess>>({});
export const projectSyncStatusAtom = atom<ProjectSyncStatus>({ state: "disabled" });
export const projectSyncActionsAtom = atom<ProjectSyncActions | null>(null);
