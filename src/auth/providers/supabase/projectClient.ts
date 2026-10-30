import { createOwnerClient } from "@/auth/providers/supabase/ownerClient";
import {
  checkProjectVersion,
  type ProjectCloudClient,
  type ProjectSaveResult,
  parseCloudProject,
  readRemoteProject,
  UnsupportedProjectVersionError,
} from "@/workspace/projectCloudSync";
import { PROJECT_SCHEMA_VERSION } from "@/workspace/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown, projectId: string): ProjectSaveResult {
  const row: unknown = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (
    !isRecord(row) ||
    typeof row.result_saved !== "boolean" ||
    (row.result_state_hash !== null &&
      (typeof row.result_state_hash !== "string" || row.result_state_hash.length === 0)) ||
    (row.result_state === null) !== (row.result_state_hash === null)
  ) {
    throw new Error("Supabase returned an invalid project save response.");
  }
  return {
    saved: row.result_saved,
    project: row.result_state === null ? null : parseCloudProject(row.result_state, projectId),
    hash: row.result_state_hash,
  };
}

export function createProjectCloudClient(userId: string): ProjectCloudClient {
  const client = createOwnerClient(userId, true);
  return {
    async load() {
      const { data, error } = await client
        .from("metadata_builder_sessions")
        .select("project_id, state, state_hash")
        .eq("user_id", userId);
      if (error) throw new Error(`Could not load cloud projects: ${error.message}`);
      return (data ?? []).map((row) => {
        if (
          typeof row.project_id !== "string" ||
          typeof row.state_hash !== "string" ||
          row.state_hash.length === 0
        ) {
          throw new Error("Supabase returned an invalid cloud project row.");
        }
        return readRemoteProject(row.state, row.project_id, row.state_hash);
      });
    },
    async save(project, hash, expectedHash) {
      checkProjectVersion(project);
      const { data, error } = await client.rpc("save_metadata_builder_session", {
        p_project_id: project.id,
        p_state: { ...project, schemaVersion: project.schemaVersion ?? PROJECT_SCHEMA_VERSION },
        p_state_hash: hash,
        p_expected_hash: expectedHash,
        p_client_updated_at: new Date().toISOString(),
      });
      if (error) {
        if (error.details === "metadata_builder_schema_version_downgrade") {
          throw new UnsupportedProjectVersionError(project.id);
        }
        throw new Error(`Could not save this cloud project: ${error.message}`);
      }
      return parseResult(data, project.id);
    },
    async remove(projectId, expectedHash) {
      const { data, error } = await client.rpc("delete_metadata_builder_session", {
        p_project_id: projectId,
        p_expected_hash: expectedHash,
      });
      if (error) throw new Error(`Could not delete this cloud project: ${error.message}`);
      return parseResult(data, projectId);
    },
  };
}
