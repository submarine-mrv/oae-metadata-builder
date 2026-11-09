import type { ProjectRecord } from "../types";

export interface RemoteProject {
  project: ProjectRecord;
  hash: string;
}

export interface UnsupportedCloudProject {
  projectId: string;
  schemaVersion?: number;
  /** Set when the row failed validation rather than being a newer format. */
  reason?: string;
}

export type CloudProject = RemoteProject | UnsupportedCloudProject;

export interface ProjectSaveResult {
  saved: boolean;
  project: ProjectRecord | null;
  hash: string | null;
}

export interface ProjectCloudClient {
  load(): Promise<CloudProject[]>;
  save(
    project: ProjectRecord,
    hash: string,
    expectedHash: string | null,
  ): Promise<ProjectSaveResult>;
  remove(projectId: string, expectedHash: string | null): Promise<ProjectSaveResult>;
}
