import { parseProjectState } from "@/utils/parseProjectState";
import { isProjectRecord } from "../storage";
import { PROJECT_SCHEMA_VERSION, type ProjectRecord } from "../types";
import type { CloudProject } from "./types";

/** A cloud project this build must not parse, save or delete: a newer draft format, or unreadable. */
export class UnsupportedProjectVersionError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly schemaVersion?: number,
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

export function readRemoteProject(value: unknown, projectId: string, hash: string): CloudProject {
  try {
    return { project: parseCloudProject(value, projectId), hash };
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
  const state = parseProjectState(value.state);
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (
    !unique(state.experiments.map((entity) => entity.id)) ||
    !unique(state.datasets.map((entity) => entity.id))
  ) {
    throw invalid();
  }
  return { ...value, schemaVersion: PROJECT_SCHEMA_VERSION, state };
}

export async function hashProject(project: ProjectRecord): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ ...project, schemaVersion: project.schemaVersion ?? PROJECT_SCHEMA_VERSION }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not save this project.";
}
