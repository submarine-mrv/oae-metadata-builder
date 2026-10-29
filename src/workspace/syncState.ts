import { atom } from "jotai";

export type ProjectSyncStatus =
  | { state: "disabled" | "loading" | "syncing" | "synced" }
  | { state: "pending"; message: string }
  | { state: "error"; message: string; projectId?: string };

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
  };
}

export interface ProjectSyncActions {
  flush(): Promise<void>;
  refresh(): Promise<void>;
  discardProjectChanges(projectId: string): Promise<void>;
  migrateLocalProjects(): Promise<void>;
  remove(projectId: string): Promise<void>;
  stop(): void;
}

export const projectSyncStatusAtom = atom<ProjectSyncStatus>({ state: "disabled" });
export const projectSyncActionsAtom = atom<ProjectSyncActions | null>(null);
