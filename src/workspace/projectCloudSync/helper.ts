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
  ) {
    super(
      reason
        ? `Project "${projectId}" could not be read and was set aside: ${reason}`
        : `Project "${projectId}" uses a newer draft format${schemaVersion === undefined ? "" : ` (version ${schemaVersion})`}. Reload the Metadata Builder before syncing this project.`,
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

/** Validate and migrate stored drafts before they enter the editing atoms. */
export function parseCloudProject(value: unknown, projectId?: string): ProjectRecord {
  checkProjectVersion(value, projectId);
  if (
    !isProjectRecord(value) ||
    !value.id.trim() ||
    (projectId !== undefined && value.id !== projectId) ||
    !Number.isFinite(value.createdAt) ||
    !Number.isFinite(value.updatedAt) ||
    !Number.isSafeInteger(value.state.nextExperimentId) ||
    !Number.isSafeInteger(value.state.nextDatasetId) ||
    value.state.nextExperimentId < 1 ||
    value.state.nextDatasetId < 1 ||
    [...value.state.experiments, ...value.state.datasets].some(
      (entity) =>
        !Number.isSafeInteger(entity.id) ||
        entity.id < 1 ||
        typeof entity.name !== "string" ||
        !Number.isFinite(entity.createdAt) ||
        !Number.isFinite(entity.updatedAt),
    ) ||
    new Set(value.state.experiments.map((entity) => entity.id)).size !==
      value.state.experiments.length ||
    new Set(value.state.datasets.map((entity) => entity.id)).size !== value.state.datasets.length ||
    value.state.experiments.some((entity) => entity.id >= value.state.nextExperimentId) ||
    value.state.datasets.some((entity) => entity.id >= value.state.nextDatasetId)
  ) {
    throw new Error("The cloud project has an invalid or unsupported format.");
  }
  return {
    ...value,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    state: parseProjectState(value.state),
  };
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
