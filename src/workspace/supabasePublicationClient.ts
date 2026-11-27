import { createAccountClient } from "@/auth/providers/supabase/projectClient";

export interface ProjectPublicationStatus {
  projectId: string;
  published: boolean;
  updatedAt: string;
  /** The live snapshot's number; each publish adds one. */
  versionNo: number;
  document: Record<string, unknown>;
}

/**
 * Why a proposed ID can't be published: used twice in this project, claimed by another
 * project's live publication, or a change to an ID this project already published.
 */
export type IdConflictReason = "duplicate" | "in_use" | "renamed";

export type IdConflict = {
  entity_type: "project" | "experiment";
  id: string;
  reason: IdConflictReason;
};

/** An experiment's internal UUID and its proposed public ID. */
export type ExperimentIdCandidate = { uuid: string; id: string };

/** The cloud draft changed since this tab last saved it; publishing would skip those edits. */
export class PublicationChangedError extends Error {
  constructor() {
    super("This project changed while publishing. Wait for it to save, then publish again.");
    this.name = "PublicationChangedError";
  }
}

const REASONS: readonly IdConflictReason[] = ["duplicate", "in_use", "renamed"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseIdConflicts(data: unknown): IdConflict[] {
  if (!Array.isArray(data)) {
    throw new Error("Supabase returned an invalid ID availability response.");
  }
  return data.map((row: unknown): IdConflict => {
    if (
      !isRecord(row) ||
      (row.entity_type !== "project" && row.entity_type !== "experiment") ||
      typeof row.id !== "string" ||
      !REASONS.includes(row.reason as IdConflictReason)
    ) {
      throw new Error("Supabase returned an invalid ID availability response.");
    }
    return { entity_type: row.entity_type, id: row.id, reason: row.reason as IdConflictReason };
  });
}

/** One sentence per conflict, for the publish error. */
export function describeIdConflicts(conflicts: IdConflict[]): string {
  return conflicts
    .map((conflict) => {
      const label = `${conflict.entity_type === "project" ? "Project" : "Experiment"} ID "${conflict.id}"`;
      return conflict.reason === "renamed"
        ? `${label} replaces a published ID, which can't change.`
        : conflict.reason === "duplicate"
          ? `${label} is used more than once in this project.`
          : `${label} is already in use.`;
    })
    .join(" ");
}

/**
 * Publication is separate from private draft sync: this client reads catalog status and asks
 * the server to publish the saved draft as a new snapshot. Saving a draft must not make its
 * edits public.
 *
 * It reuses the shared Supabase session through an account-bound client, which checks the user
 * before each request so an account switch cannot send an operation with another user's token.
 * Supabase enforces that only the owner publishes.
 */
export function createPublicationClient(ownerId: string) {
  // Keep publication RPCs out of the keepalive budget used for draft saves during page unload.
  const client = createAccountClient(ownerId, false);
  const status = async (projectUuid: string): Promise<ProjectPublicationStatus | null> => {
    const { data, error } = await client
      .from("published_projects")
      .select("project_id, version_no, published_at, document")
      .eq("project_uuid", projectUuid)
      .maybeSingle();
    if (error) throw new Error(`Could not check publication: ${error.message}`);
    if (data === null) return null;
    if (
      !isRecord(data) ||
      typeof data.project_id !== "string" ||
      typeof data.version_no !== "number" ||
      !validDate(data.published_at) ||
      !isRecord(data.document)
    ) {
      throw new Error("Supabase returned an invalid publication status.");
    }
    return {
      projectId: data.project_id,
      published: true,
      updatedAt: data.published_at,
      versionNo: data.version_no,
      document: data.document,
    };
  };
  return {
    /**
     * IDs publish would reject. Pass the proposed project ID and experiments to check values
     * not saved yet; omit both to check the saved draft.
     */
    async checkIds(
      projectUuid: string,
      projectId?: string,
      experiments?: ExperimentIdCandidate[],
    ): Promise<IdConflict[]> {
      const { data, error } = await client.rpc("check_metadata_builder_id_availability", {
        p_project_uuid: projectUuid,
        p_project_id: projectId ?? null,
        p_experiments: experiments ?? null,
      });
      if (error) throw new Error(`Could not check ID availability: ${error.message}`);
      return parseIdConflicts(data);
    },
    async publishedProjectIds(projectUuids: string[]): Promise<string[]> {
      if (projectUuids.length === 0) return [];
      const { data, error } = await client
        .from("published_projects")
        .select("project_uuid")
        .in("project_uuid", projectUuids);
      if (error) throw new Error(`Could not check project publications: ${error.message}`);
      if (!Array.isArray(data)) {
        throw new Error("Supabase returned invalid project publication statuses.");
      }
      return data.map((row: unknown) => {
        if (
          !isRecord(row) ||
          typeof row.project_uuid !== "string" ||
          !projectUuids.includes(row.project_uuid)
        ) {
          throw new Error("Supabase returned invalid project publication statuses.");
        }
        return row.project_uuid;
      });
    },
    status,
    /**
     * Publishes the saved draft. `expectedHash` is the project hash this tab last saved; the
     * server refuses if the draft has changed since, so what is published is what was reviewed.
     */
    async publish(projectUuid: string, expectedHash: string): Promise<ProjectPublicationStatus> {
      const { data, error } = await client.rpc("publish_oae_project", {
        p_project_uuid: projectUuid,
        p_expected_project_hash: expectedHash,
      });
      if (error) {
        if (error.details === "metadata_builder_project_changed") {
          throw new PublicationChangedError();
        }
        if (error.details === "oae_duplicate_ids") {
          throw new Error(
            `${describeIdConflicts(parseIdConflicts(JSON.parse(error.hint)))} Choose unique IDs before publishing. Your draft is saved.`,
          );
        }
        if (error.details === "oae_invalid_ids") {
          throw new Error(`Fix the invalid IDs before publishing: ${error.message}`);
        }
        throw new Error(`Could not publish project: ${error.message}`);
      }
      const row: unknown = Array.isArray(data) && data.length === 1 ? data[0] : data;
      if (
        !isRecord(row) ||
        typeof row.result_project_id !== "string" ||
        typeof row.result_version_no !== "number" ||
        !validDate(row.result_published_at)
      ) {
        throw new Error(
          "Supabase returned an invalid publication response. Check status and retry.",
        );
      }
      const published = await status(projectUuid);
      if (!published || published.versionNo !== row.result_version_no) {
        throw new Error("The publication changed again. Check its status and retry.");
      }
      return published;
    },
    async unpublish(projectUuid: string): Promise<void> {
      const { data, error } = await client.rpc("unpublish_oae_project", {
        p_project_uuid: projectUuid,
      });
      if (error) throw new Error(`Could not unpublish project: ${error.message}`);
      if (data !== true) {
        throw new Error(
          "No matching publication was found. Refresh its status before trying again.",
        );
      }
    },
  };
}
