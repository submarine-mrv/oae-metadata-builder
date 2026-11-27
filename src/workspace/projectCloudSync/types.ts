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

/**
 * A person on a project. Pending people were invited but haven't accepted yet; they have no
 * access and only the owner sees them.
 */
export interface ProjectMember {
  userId: string;
  /** Their current account email, so it follows email changes. */
  email: string;
  role: ProjectRole;
  status: "active" | "pending";
  /** When an invitation was last emailed; null for people added with an existing account. */
  lastInvitedAt: string | null;
}

export interface RemoteProject {
  project: ProjectRecord;
  /** The server's project hash, a token that changes on every write. */
  hash: string;
  /**
   * Server content hashes of the rows as `project` holds them: `project` for the project row
   * and each experiment's and dataset's UUID. Saves send them as the base of changed rows.
   */
  rows?: Record<string, string>;
  /** The protocol schema version the cloud copy conforms to. */
  schemaVersion?: string;
}

export interface UnsupportedCloudProject {
  projectId: string;
  /** The newer protocol schema version, or a draft-format number from local data. */
  schemaVersion?: string | number;
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

/**
 * `saved` with `project` set means the server applied every change. Without `merged`, nobody
 * else had written and `project` is what was sent. With `merged`, others had changed other rows
 * and `project` is the combined cloud copy. Not `saved` with a `project` is a conflict: nothing
 * was written and `project` is the cloud copy to merge with. Not `saved` without one means the
 * project is gone.
 */
export interface ProjectSaveResult {
  saved: boolean;
  merged?: boolean;
  project: ProjectRecord | null;
  hash: string | null;
  rows?: Record<string, string>;
  schemaVersion?: string;
}

export interface ProjectCloudClient {
  load(): Promise<CloudProject[]>;
  /** Each project's current hash and access, to check for changes without loading state. */
  hashes(): Promise<Map<string, ProjectVersion>>;
  /**
   * Sends what changed in `project` since `base`, the copy last acknowledged by the cloud.
   * Without a base, or when the base is an older schema version, it rewrites the whole project.
   */
  save(project: ProjectRecord, base: RemoteProject | null): Promise<ProjectSaveResult>;
  remove(projectId: string, expectedHash: string | null): Promise<ProjectSaveResult>;
}
