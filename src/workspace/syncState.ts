import { atom } from "jotai";
import { UnsupportedProjectVersionError } from "./projectCloudSync/helper";

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

export function projectSyncErrorStatus(error: unknown): ProjectSyncStatus {
  return {
    state: "error",
    message: error instanceof Error ? error.message : "Could not sync this project.",
    ...(error instanceof ProjectConflictError ? { projectId: error.projectId } : {}),
    // Saving again can't settle a conflict or a newer-format project.
    ...(error instanceof ProjectConflictError || error instanceof UnsupportedProjectVersionError
      ? { noRetry: true as const }
      : {}),
  };
}

export interface ProjectSyncActions {
  flush(): Promise<void>;
  migrateLocalProjects(): Promise<void>;
  remove(projectId: string): Promise<void>;
  stop(): void;
}

/** Something removed here because it was deleted elsewhere. The UI shows these, then clears them. */
export interface RemoteDeletion {
  type: "project" | "experiment" | "dataset";
  name: string;
  /** Experiments and datasets only: where it was, so the UI can leave its page. */
  projectId?: string;
  id?: number;
  /** Set for experiments and datasets edited here. A project is only removed while saving edits to it. */
  unsavedEdits?: true;
}

export const remoteDeletionsAtom = atom<RemoteDeletion[]>([]);
export const projectSyncStatusAtom = atom<ProjectSyncStatus>({ state: "disabled" });
export const projectSyncActionsAtom = atom<ProjectSyncActions | null>(null);
