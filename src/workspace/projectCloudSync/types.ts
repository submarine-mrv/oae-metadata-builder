import type { ProjectRecord } from "../types";

export type ProjectRole = "owner" | "editor" | "viewer";

/** The signed-in user's relationship to a cloud project. */
export interface ProjectAccess {
  role: ProjectRole;
  ownerEmail: string;
  /** Who saved last; null before anyone saves through the server. */
  updatedByEmail: string | null;
  /** Editors and viewers besides the owner; above zero means shared. */
  memberCount: number;
}

/** A person on a project, as the owner manages them. */
export interface ProjectMember {
  email: string;
  role: ProjectRole;
}

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

/** A loaded row. Rows without `access` are the caller's own private projects. */
export type CloudProject = (RemoteProject | UnsupportedCloudProject) & { access?: ProjectAccess };

/** What the cheap change check returns per project. */
export interface ProjectVersion {
  hash: string;
  access?: ProjectAccess;
}

export interface ProjectSaveResult {
  saved: boolean;
  project: ProjectRecord | null;
  hash: string | null;
}

export interface ProjectCloudClient {
  load(): Promise<CloudProject[]>;
  /** Each project's current hash and access, to check for changes without loading state. */
  hashes(): Promise<Map<string, ProjectVersion>>;
  save(
    project: ProjectRecord,
    hash: string,
    expectedHash: string | null,
  ): Promise<ProjectSaveResult>;
  remove(projectId: string, expectedHash: string | null): Promise<ProjectSaveResult>;
}
