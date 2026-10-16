import { supabase } from "@/auth/providers/supabase/client";
import type { RemoteWorkspace, WorkspaceCloudClient, WorkspaceSaveResult } from "./cloudSync";
import type { Workspace } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSaveResult(value: unknown): WorkspaceSaveResult {
  const row = Array.isArray(value) ? value[0] : value;
  if (
    !isRecord(row) ||
    typeof row.result_saved !== "boolean" ||
    (row.result_state_hash !== null && typeof row.result_state_hash !== "string")
  ) {
    throw new Error("Supabase returned an invalid workspace save response.");
  }
  return {
    saved: row.result_saved,
    state: row.result_state ?? null,
    stateHash: row.result_state_hash,
  };
}

export const supabaseWorkspaceClient: WorkspaceCloudClient = {
  async load(): Promise<RemoteWorkspace | null> {
    const { data, error } = await supabase
      .from("metadata_builder_sessions")
      .select("state, state_hash")
      .maybeSingle();
    if (error) throw new Error(`Could not load the cloud workspace: ${error.message}`);
    if (!data) return null;
    if (typeof data.state_hash !== "string" || data.state_hash.length === 0) {
      throw new Error("Supabase returned an invalid workspace hash.");
    }
    return { state: data.state, stateHash: data.state_hash };
  },

  async save(
    workspace: Workspace,
    stateHash: string,
    expectedHash: string | null,
  ): Promise<WorkspaceSaveResult> {
    const { data, error } = await supabase.rpc("save_metadata_builder_session", {
      p_state: workspace,
      p_state_hash: stateHash,
      p_expected_hash: expectedHash,
      p_client_updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Could not sync the cloud workspace: ${error.message}`);
    return parseSaveResult(data);
  },
};
