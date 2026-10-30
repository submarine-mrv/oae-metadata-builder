import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/auth/providers/supabase/client";
import {
  checkProjectVersion,
  type ProjectCloudClient,
  type ProjectSaveResult,
  parseCloudProject,
  readRemoteProject,
  UnsupportedProjectVersionError,
} from "@/workspace/projectCloudSync";
import { PROJECT_SCHEMA_VERSION, type ProjectRecord } from "@/workspace/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown, projectId: string, sent?: ProjectRecord): ProjectSaveResult {
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
    // The server stored exactly what was sent; re-validating it could fail a committed save.
    project:
      row.result_state === null
        ? null
        : row.result_saved && sent
          ? sent
          : parseCloudProject(row.result_state, projectId),
    hash: row.result_state_hash,
  };
}

export function createProjectCloudClient(userId: string): ProjectCloudClient {
  // Capture an owner-checked token for each request, never a later account's token.
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: (input, init) => {
          const body = init?.body;
          // Browsers cap outstanding keepalive bodies at 64 KiB; large drafts use normal autosave.
          const keepalive =
            typeof body === "string" && new TextEncoder().encode(body).byteLength <= 60_000;
          return fetch(input, { ...init, keepalive });
        },
      },
      accessToken: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(`Could not authenticate project sync: ${error.message}`);
        if (!data.session || data.session.user.id !== userId) {
          throw new Error("The account changed. Project sync has been stopped.");
        }
        return data.session.access_token;
      },
    },
  );
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
      const state = { ...project, schemaVersion: project.schemaVersion ?? PROJECT_SCHEMA_VERSION };
      const { data, error } = await client.rpc("save_metadata_builder_session", {
        p_project_id: project.id,
        p_state: state,
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
      return parseResult(data, project.id, state);
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
