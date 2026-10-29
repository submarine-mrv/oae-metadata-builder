import type { ProjectRecord } from "../types";

export interface RemoteProject {
  project: ProjectRecord;
  hash: string;
}

export interface ProjectSaveResult {
  saved: boolean;
  project: ProjectRecord | null;
  hash: string | null;
}

export interface ProjectCloudClient {
  load(): Promise<RemoteProject[]>;
  save(
    project: ProjectRecord,
    hash: string,
    expectedHash: string | null,
  ): Promise<ProjectSaveResult>;
  remove(projectId: string, expectedHash: string | null): Promise<ProjectSaveResult>;
}
