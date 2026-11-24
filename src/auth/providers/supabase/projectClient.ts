import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/auth/providers/supabase/client";
import { buildAuthRedirectUrl } from "@/auth/redirects";
import {
  checkProjectVersion,
  type ProjectAccess,
  ProjectAccessError,
  type ProjectCloudClient,
  type ProjectMember,
  type ProjectRole,
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

// Capture an owner-checked token for each request, never a later account's token.
export function createAccountClient(userId: string, keepaliveRequests = true) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: (input, init) => {
          const body = init?.body;
          // Browsers cap outstanding keepalive bodies at 64 KiB; large drafts use normal autosave.
          const keepalive =
            keepaliveRequests &&
            typeof body === "string" &&
            new TextEncoder().encode(body).byteLength <= 60_000;
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
}

const ROLES: readonly ProjectRole[] = ["owner", "editor", "viewer"];

/** Owned and shared projects with the caller's access; state only when asked for. */
async function listProjects(client: ReturnType<typeof createAccountClient>, withState: boolean) {
  const { data, error } = await client.rpc("list_metadata_builder_projects", {
    p_include_state: withState,
  });
  if (error) throw new Error(`Could not load cloud projects: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    if (
      typeof row.project_uuid !== "string" ||
      typeof row.state_hash !== "string" ||
      row.state_hash.length === 0 ||
      !ROLES.includes(row.role as ProjectRole) ||
      typeof row.owner_email !== "string" ||
      (row.updated_by_email !== null && typeof row.updated_by_email !== "string") ||
      typeof row.member_count !== "number"
    ) {
      throw new Error("Supabase returned an invalid cloud project row.");
    }
    const access: ProjectAccess = {
      role: row.role as ProjectRole,
      ownerEmail: row.owner_email,
      updatedByEmail: (row.updated_by_email as string | null) ?? null,
      memberCount: row.member_count,
    };
    return { id: row.project_uuid, hash: row.state_hash, state: row.state, access };
  });
}

export function createProjectCloudClient(userId: string): ProjectCloudClient {
  const client = createAccountClient(userId);
  return {
    async load() {
      return (await listProjects(client, true)).map((row) => ({
        ...readRemoteProject(row.state, row.id, row.hash),
        access: row.access,
      }));
    },
    async hashes() {
      return new Map(
        (await listProjects(client, false)).map((row) => [
          row.id,
          { hash: row.hash, access: row.access },
        ]),
      );
    },
    async save(project, hash, expectedHash) {
      checkProjectVersion(project);
      const state = { ...project, schemaVersion: project.schemaVersion ?? PROJECT_SCHEMA_VERSION };
      const { data, error } = await client.rpc("save_metadata_builder_session", {
        p_project_uuid: project.id,
        p_state: state,
        p_state_hash: hash,
        p_expected_hash: expectedHash,
        p_client_updated_at: new Date().toISOString(),
      });
      if (error) {
        if (error.details === "metadata_builder_schema_version_downgrade") {
          throw new UnsupportedProjectVersionError(project.id, undefined, undefined, true);
        }
        if (error.code === "42501") throw new ProjectAccessError(project.id);
        throw new Error(`Could not save this cloud project: ${error.message}`);
      }
      return parseResult(data, project.id, state);
    },
    async remove(projectId, expectedHash) {
      const { data, error } = await client.rpc("delete_metadata_builder_session", {
        p_project_uuid: projectId,
        p_expected_hash: expectedHash,
      });
      if (error) throw new Error(`Could not delete this cloud project: ${error.message}`);
      return parseResult(data, projectId);
    },
  };
}

export type MemberRole = Exclude<ProjectRole, "owner">;

/**
 * What adding someone did. If their invitation email can't be sent, they aren't added and the
 * call throws a MemberRequestError (`rate_limited` or `invite_failed`).
 */
export type InviteResult = { status: "added" | "role_updated" | "invited"; userId: string };

/** A refused member change; `code` is the project-members function's error code when known. */
export class MemberRequestError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "MemberRequestError";
  }
}

const INVITE_STATUSES = new Set(["added", "role_updated", "invited"]);

function parseMember(row: unknown): ProjectMember {
  if (
    !isRecord(row) ||
    typeof row.user_id !== "string" ||
    typeof row.email !== "string" ||
    !ROLES.includes(row.role as ProjectRole) ||
    (row.status !== "active" && row.status !== "pending") ||
    (row.last_invited_at !== null && typeof row.last_invited_at !== "string")
  ) {
    throw new Error("Supabase returned an invalid project member row.");
  }
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role as ProjectRole,
    status: row.status,
    lastInvitedAt: row.last_invited_at,
  };
}

/** Who is on a project, and the owner's controls for changing that. */
export function createProjectMembersClient(userId: string) {
  const client = createAccountClient(userId, false);
  const call = async (name: string, args: Record<string, unknown>, failure: string) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new MemberRequestError(`${failure}: ${error.message}`, error.code ?? null);
    return data;
  };
  // Invites go through the project-members Edge Function, which may create the person's account.
  const invoke = async (body: Record<string, unknown>, failure: string) => {
    const { data, error } = await client.functions.invoke("project-members", {
      body: {
        ...body,
        redirectTo: buildAuthRedirectUrl({ type: "invite", returnTo: "/overview" }),
      },
    });
    if (error) {
      const context: unknown = (error as { context?: unknown }).context;
      const details: unknown =
        context instanceof Response ? await context.json().catch(() => null) : null;
      throw new MemberRequestError(
        isRecord(details) && typeof details.error === "string"
          ? details.error
          : `${failure}: ${error.message}`,
        isRecord(details) && typeof details.code === "string" ? details.code : null,
      );
    }
    if (!isRecord(data) || !INVITE_STATUSES.has(data.status as string)) {
      throw new Error("The project-members function returned an invalid response.");
    }
    return data as InviteResult;
  };
  return {
    async list(projectId: string): Promise<ProjectMember[]> {
      const rows = await call(
        "list_metadata_builder_project_members",
        { p_project_uuid: projectId },
        "Could not load the people on this project",
      );
      return ((rows ?? []) as unknown[]).map(parseMember);
    },
    /** Adds someone by email: existing accounts at once, anyone else by invitation. */
    invite(projectId: string, email: string, role: MemberRole): Promise<InviteResult> {
      return invoke({ action: "invite", projectId, email, role }, "Could not add this person");
    },
    /** Emails a pending person a fresh invitation link. */
    resend(projectId: string, memberId: string): Promise<InviteResult> {
      return invoke(
        { action: "resend", projectId, userId: memberId },
        "Could not resend this invitation",
      );
    },
    async setRole(projectId: string, memberId: string, role: MemberRole) {
      await call(
        "set_metadata_builder_project_member_role",
        { p_project_uuid: projectId, p_user_id: memberId, p_role: role },
        "Could not change this person's role",
      );
    },
    /** Removes someone; members pass their own ID to leave. */
    async remove(projectId: string, memberId: string) {
      await call(
        "remove_metadata_builder_project_member",
        { p_project_uuid: projectId, p_user_id: memberId },
        "Could not remove this person",
      );
    },
  };
}
