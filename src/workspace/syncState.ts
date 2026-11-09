import { atom } from "jotai";

export type ProjectSyncStatus =
  | { state: "disabled" | "loading" | "syncing" | "synced" }
  | { state: "pending" | "error"; message: string };

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
}

export const remoteDeletionsAtom = atom<RemoteDeletion[]>([]);
export const projectSyncStatusAtom = atom<ProjectSyncStatus>({ state: "disabled" });
export const projectSyncActionsAtom = atom<ProjectSyncActions | null>(null);
