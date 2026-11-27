import { parseProjectState } from "@/utils/parseProjectState";
import { getProtocolMetadata } from "@/utils/schemaViews";
import { isProjectRecord } from "../storage";
import { PROJECT_SCHEMA_VERSION, type ProjectRecord } from "../types";
import { readCloudState } from "./rows";
import type { CloudProject } from "./types";

/** The protocol release this build's drafts conform to; the cloud records it per project. */
export const PROTOCOL_SCHEMA_VERSION: string = getProtocolMetadata().version;

/** Orders `major.minor.patch` versions numerically, so 0.10.0 is newer than 0.9.0. */
export function compareSchemaVersions(a: string, b: string): number {
  const parts = (version: string) => version.split(".").map(Number);
  const [left, right] = [parts(a), parts(b)];
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

const VERSION = /^\d+\.\d+\.\d+$/;

/** A cloud project this build must not parse, save or delete: a newer draft format, or unreadable. */
export class UnsupportedProjectVersionError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly schemaVersion?: string | number,
    public readonly reason?: string,
    public readonly unsavedEdits = false,
  ) {
    super(
      reason
        ? "One project in your account couldn't be opened. It hasn't been changed or deleted."
        : unsavedEdits
          ? "A project in your account was saved by a newer version of the Metadata Builder. Reload the page to keep editing it. Edits made in this tab since then can't be saved."
          : "A project in your account was saved by a newer version of the Metadata Builder. Reload the page to open it.",
    );
    this.name = "UnsupportedProjectVersionError";
  }
}

/** The server refused a save because the user can no longer edit this project. */
export class ProjectAccessError extends Error {
  constructor(public readonly projectId: string) {
    super("You can no longer edit this project.");
    this.name = "ProjectAccessError";
  }
}

/** Check the version before any state validation or migration can drop future fields. */
export function checkProjectVersion(value: unknown, projectId?: string): number {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    (projectId !== undefined && value.id !== projectId)
  ) {
    throw new Error("The cloud project has an invalid or unsupported format.");
  }
  const version = "schemaVersion" in value ? value.schemaVersion : 1;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
    throw new Error("The cloud project has an invalid schema version.");
  }
  if (version > PROJECT_SCHEMA_VERSION) {
    throw new UnsupportedProjectVersionError(value.id, version);
  }
  return version;
}

/** A cloud row: its project hash, protocol schema version and state as the server sends them. */
export function readRemoteProject(
  projectId: string,
  hash: string,
  schemaVersion: string,
  state: unknown,
): CloudProject {
  try {
    if (!VERSION.test(schemaVersion))
      throw new Error("The cloud project has an invalid schema version.");
    if (compareSchemaVersions(schemaVersion, PROTOCOL_SCHEMA_VERSION) > 0) {
      throw new UnsupportedProjectVersionError(projectId, schemaVersion);
    }
    const { record, rows } = readCloudState(state, projectId);
    return { project: parseCloudProject(record, projectId), hash, rows, schemaVersion };
  } catch (error) {
    if (error instanceof UnsupportedProjectVersionError) {
      return { projectId: error.projectId, schemaVersion: error.schemaVersion };
    }
    // One unreadable row must not block every other project from loading.
    return { projectId, reason: errorMessage(error) };
  }
}

/** A string ID, or a positive integer from drafts made before string IDs. */
const isEntityId = (id: unknown) =>
  (typeof id === "string" && id.trim() !== "") || (Number.isSafeInteger(id) && (id as number) >= 1);

/** Validate and migrate stored drafts before they enter the editing atoms. */
export function parseCloudProject(value: unknown, projectId?: string): ProjectRecord {
  checkProjectVersion(value, projectId);
  const invalid = () => new Error("The cloud project has an invalid or unsupported format.");
  if (
    !isProjectRecord(value) ||
    !value.id.trim() ||
    (projectId !== undefined && value.id !== projectId) ||
    !Number.isFinite(value.createdAt) ||
    !Number.isFinite(value.updatedAt) ||
    [...value.state.experiments, ...value.state.datasets].some(
      (entity) =>
        !isEntityId(entity.id) ||
        typeof entity.name !== "string" ||
        !Number.isFinite(entity.createdAt) ||
        !Number.isFinite(entity.updatedAt),
    )
  ) {
    throw invalid();
  }
  // Entity IDs in the cloud are UUIDs unique across projects.
  const state = parseProjectState(value.state, value.id);
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (
    !unique(state.experiments.map((entity) => entity.id)) ||
    !unique(state.datasets.map((entity) => entity.id))
  ) {
    throw invalid();
  }
  return { ...value, schemaVersion: PROJECT_SCHEMA_VERSION, state };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not save this project.";
}
