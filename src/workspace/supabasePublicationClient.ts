import { createOwnerClient } from "@/auth/providers/supabase/ownerClient";
import type { ProjectPublicationPayload } from "./publicationPayload";

export interface ProjectPublicationStatus {
  projectId: string;
  published: boolean;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function createPublicationClient(ownerId: string) {
  const client = createOwnerClient(ownerId);
  return {
    async status(sourceProjectId: string): Promise<ProjectPublicationStatus | null> {
      const { data, error } = await client
        .from("oae_projects")
        .select("project_id, published, updated_at")
        .eq("owner_id", ownerId)
        .eq("builder_project_id", sourceProjectId)
        .maybeSingle();
      if (error) throw new Error(`Could not check publication: ${error.message}`);
      if (data === null) return null;
      if (
        !isRecord(data) ||
        typeof data.project_id !== "string" ||
        typeof data.published !== "boolean" ||
        !validDate(data.updated_at)
      ) {
        throw new Error("Supabase returned an invalid publication status.");
      }
      return { projectId: data.project_id, published: data.published, updatedAt: data.updated_at };
    },
    async publish(
      sourceProjectId: string,
      payload: ProjectPublicationPayload,
    ): Promise<ProjectPublicationStatus> {
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
