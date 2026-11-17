import { createAccountClient } from "@/auth/providers/supabase/projectClient";
import type { ProjectPublicationPayload } from "./publicationPayload";

export interface ProjectPublicationStatus {
  projectId: string;
  published: boolean;
  updatedAt: string;
  document: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/**
 * Publication is separate from private draft sync: this client reads catalog
 * status and uses dedicated RPCs to publish or unpublish an explicit snapshot.
 * Saving a draft must not make its edits public.
 *
 * It reuses the shared Supabase session through an account-bound client, which
 * checks the user before each request so an account switch cannot send an
 * operation with another user's token. Supabase enforces mutation ownership.
 */
export function createPublicationClient(ownerId: string) {
  // Keep publication RPCs out of the keepalive budget used for draft saves during page unload.
  const client = createAccountClient(ownerId, false);
  return {
    async publishedProjectIds(sourceProjectIds: string[]): Promise<string[]> {
      if (sourceProjectIds.length === 0) return [];
      const { data, error } = await client
        .from("oae_projects")
        .select("builder_project_id")
        .eq("published", true)
        .in("builder_project_id", sourceProjectIds);
      if (error) throw new Error(`Could not check project publications: ${error.message}`);
      if (!Array.isArray(data)) {
        throw new Error("Supabase returned invalid project publication statuses.");
      }
      return data.map((row: unknown) => {
        if (
          !isRecord(row) ||
          typeof row.builder_project_id !== "string" ||
          !sourceProjectIds.includes(row.builder_project_id)
        ) {
          throw new Error("Supabase returned invalid project publication statuses.");
        }
        return row.builder_project_id;
      });
    },
    async status(sourceProjectId: string): Promise<ProjectPublicationStatus | null> {
      const { data, error } = await client
        .from("oae_projects")
        .select("project_id, published, updated_at, document:extras->_document")
        .eq("owner_id", ownerId)
        .eq("builder_project_id", sourceProjectId)
        .maybeSingle();
      if (error) throw new Error(`Could not check publication: ${error.message}`);
      if (data === null) return null;
      if (
        !isRecord(data) ||
        typeof data.project_id !== "string" ||
        typeof data.published !== "boolean" ||
        !validDate(data.updated_at) ||
        !isRecord(data.document)
      ) {
        throw new Error("Supabase returned an invalid publication status.");
      }
      return {
        projectId: data.project_id,
        published: data.published,
        updatedAt: data.updated_at,
        document: data.document,
      };
    },
    async publish(
      sourceProjectId: string,
      payload: ProjectPublicationPayload,
    ): Promise<ProjectPublicationStatus> {
      const extras = payload.project.extras;
      if (!isRecord(extras) || !isRecord(extras._document)) {
        throw new Error("The publication payload is missing its metadata document.");
      }
      const { data, error } = await client.rpc("publish_oae_project", {
        p_source_project_id: sourceProjectId,
        p_project: payload.project,
        p_experiments: payload.experiments,
        p_datasets: payload.datasets,
      });
      if (error) throw new Error(`Could not publish project: ${error.message}`);
      const row: unknown = Array.isArray(data) && data.length === 1 ? data[0] : data;
      if (
        !isRecord(row) ||
        typeof row.result_project_id !== "string" ||
        row.result_project_id !== payload.project.project_id ||
        !validDate(row.result_published_at) ||
        row.result_experiment_count !== payload.experiments.length ||
        row.result_dataset_count !== payload.datasets.length
      ) {
        throw new Error(
          "Supabase returned an invalid publication response. Check status and retry.",
        );
      }
      return {
        projectId: row.result_project_id,
        published: true,
        updatedAt: row.result_published_at,
        document: extras._document,
      };
    },
    async unpublish(sourceProjectId: string): Promise<void> {
      const { data, error } = await client.rpc("unpublish_oae_project", {
        p_source_project_id: sourceProjectId,
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
