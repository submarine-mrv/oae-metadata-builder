import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProjectState, newProjectRecord } from "@/workspace/types";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "owner" }, access_token: "owner-token" } as {
    user: { id: string };
    access_token: string;
  } | null,
  options: null as { accessToken(): Promise<string> } | null,
  rows: [] as unknown[],
  loadError: null as { message: string } | null,
  rpc: vi.fn(),
  list: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("../client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: mocks.session }, error: null }) },
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: { accessToken(): Promise<string> }) => {
    mocks.options = options;
    return {
      functions: { invoke: mocks.invoke },
      rpc: async (name: string, args: unknown) => {
        await options.accessToken();
        if (name !== "list_metadata_builder_projects") return mocks.rpc(name, args);
        mocks.list(args);
        return {
          data: (mocks.rows as Record<string, unknown>[]).map((row) => ({
            ...ownerAccess,
            ...row,
          })),
          error: mocks.loadError,
        };
      },
    };
  },
}));

import { ProjectAccessError } from "@/workspace/projectCloudSync";
import { createProjectCloudClient, createProjectMembersClient } from "../projectClient";

const ownerAccess = {
  role: "owner",
  owner_email: "owner@example.com",
  updated_by_email: null,
  member_count: 0,
};
const access = {
  role: "owner",
  ownerEmail: "owner@example.com",
  updatedByEmail: null,
  memberCount: 0,
};

describe("owner-bound project Supabase client", () => {
  const project = { ...newProjectRecord(emptyProjectState(), 100), id: "internal-project" };
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [{ project_id: project.id, state: project, state_hash: "hash" }];
    mocks.loadError = null;
    mocks.session = { user: { id: "owner" }, access_token: "owner-token" };
    mocks.rpc.mockResolvedValue({
      data: [{ result_saved: true, result_state: project, result_state_hash: "next" }],
      error: null,
    });
  });

  it("reads owned and shared projects with the caller's access through one RPC", async () => {
    const client = createProjectCloudClient("owner");
    const rows = await client.load();
    expect(mocks.list).toHaveBeenCalledWith({ p_include_state: true });
    expect(rows[0]).toMatchObject({ project: { id: project.id }, access });
    expect(await mocks.options?.accessToken()).toBe("owner-token");
  });

  it("checks hashes and access without loading state", async () => {
    mocks.rows = [{ project_id: project.id, state: null, state_hash: "hash", role: "viewer" }];
    const versions = await createProjectCloudClient("owner").hashes();
    expect(mocks.list).toHaveBeenCalledWith({ p_include_state: false });
    expect(versions.get(project.id)).toEqual({
      hash: "hash",
      access: { ...access, role: "viewer" },
    });
  });

  it("rejects rows with an unknown role", async () => {
    mocks.rows = [{ project_id: project.id, state: project, state_hash: "hash", role: "admin" }];
    await expect(createProjectCloudClient("owner").load()).rejects.toThrow("invalid");
  });

  it("reports a refused save as lost edit access", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied", code: "42501" } });
    await expect(createProjectCloudClient("owner").save(project, "next", "hash")).rejects.toThrow(
      ProjectAccessError,
    );
  });

  it("manages members by user ID through the member RPCs", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          user_id: "bob",
          email: "bob@example.com",
          role: "editor",
          status: "pending",
          last_invited_at: "2026-09-20T10:00:00Z",
        },
      ],
      error: null,
    });
    const members = createProjectMembersClient("owner");
    expect(await members.list("p")).toEqual([
      {
        userId: "bob",
        email: "bob@example.com",
        role: "editor",
        status: "pending",
        lastInvitedAt: "2026-09-20T10:00:00Z",
      },
    ]);
    await members.setRole("p", "bob", "viewer");
    expect(mocks.rpc).toHaveBeenCalledWith("set_metadata_builder_project_member_role", {
      p_project_id: "p",
      p_user_id: "bob",
      p_role: "viewer",
    });
    await members.remove("p", "bob");
    expect(mocks.rpc).toHaveBeenCalledWith("remove_metadata_builder_project_member", {
      p_project_id: "p",
      p_user_id: "bob",
    });
  });

  it("rejects member rows without a status", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ user_id: "bob", email: "bob@example.com", role: "editor", last_invited_at: null }],
      error: null,
    });
    await expect(createProjectMembersClient("owner").list("p")).rejects.toThrow("invalid");
  });

  it("invites and resends through the project-members function with an invite link", async () => {
    mocks.invoke.mockResolvedValue({ data: { status: "invited", userId: "bob" }, error: null });
    const members = createProjectMembersClient("owner");
    await expect(members.invite("p", "bob@example.com", "viewer")).resolves.toEqual({
      status: "invited",
      userId: "bob",
    });
    const [name, { body }] = mocks.invoke.mock.calls[0];
    expect(name).toBe("project-members");
    expect(body).toMatchObject({
      action: "invite",
      projectId: "p",
      email: "bob@example.com",
      role: "viewer",
    });
    const redirect = new URL(body.redirectTo);
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("type")).toBe("invite");
    expect(redirect.searchParams.get("returnTo")).toBe("/overview");

    await members.resend("p", "bob");
    expect(mocks.invoke.mock.calls[1][1].body).toMatchObject({
      action: "resend",
      projectId: "p",
      userId: "bob",
    });
  });

  it("surfaces the project-members function's error code", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ error: "Slow down", code: "cooldown" }), {
          status: 429,
        }),
      },
    });
    await expect(createProjectMembersClient("owner").resend("p", "bob")).rejects.toMatchObject({
      message: "Slow down",
      code: "cooldown",
    });
  });

  it("uses project-scoped conditional-save arguments without accepting a user ID", async () => {
    const client = createProjectCloudClient("owner");
    await client.save(project, "next", "previous");
    expect(mocks.rpc).toHaveBeenCalledWith("save_metadata_builder_session", {
      p_project_id: project.id,
      p_state: project,
      p_state_hash: "next",
      p_expected_hash: "previous",
      p_client_updated_at: expect.any(String),
    });
  });

  it("reports future projects without parsing their state or hiding supported projects", async () => {
    mocks.rows.push({
      project_id: "future",
      state: { id: "future", schemaVersion: 3, state: { futureField: true } },
      state_hash: "future-hash",
    });
    expect(await createProjectCloudClient("owner").load()).toEqual([
      { project, hash: "hash", access },
      { projectId: "future", schemaVersion: 3, access },
    ]);
  });

  it("rejects newer local formats before sending a write", async () => {
    await expect(
      createProjectCloudClient("owner").save({ ...project, schemaVersion: 3 }, "next", "hash"),
    ).rejects.toThrow("Reload");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("surfaces server downgrade protection as a reload-required error", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Version downgrade",
        details: "metadata_builder_schema_version_downgrade",
      },
    });
    await expect(createProjectCloudClient("owner").save(project, "next", "hash")).rejects.toThrow(
      "Reload",
    );
  });

  it("deletes only the requested project and expected revision", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ result_saved: true, result_state: null, result_state_hash: null }],
      error: null,
    });
    const result = await createProjectCloudClient("owner").remove(project.id, "previous");
    expect(result).toEqual({ saved: true, project: null, hash: null });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_metadata_builder_session", {
      p_project_id: project.id,
      p_expected_hash: "previous",
    });
  });

  it("rejects account changes before sending writes with a different token", async () => {
    const client = createProjectCloudClient("owner");
    mocks.session = { user: { id: "other" }, access_token: "other-token" };
    await expect(client.save(project, "next", "previous")).rejects.toThrow("account changed");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.session = null;
    await expect(client.load()).rejects.toThrow("account changed");
  });

  it("surfaces query and RPC errors instead of claiming success", async () => {
    const client = createProjectCloudClient("owner");
    mocks.loadError = { message: "no read access" };
    await expect(client.load()).rejects.toThrow("no read access");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "save denied" } });
    await expect(client.save(project, "next", null)).rejects.toThrow("save denied");
  });

  it("keeps a committed save even when the echoed state would fail client validation", async () => {
    const client = createProjectCloudClient("owner");
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result_saved: true,
          result_state: { ...project, state: { ...project.state, nextExperimentId: 0 } },
          result_state_hash: "next",
        },
      ],
      error: null,
    });
    await expect(client.save(project, "next", null)).resolves.toMatchObject({
      saved: true,
      hash: "next",
      project: { id: project.id },
    });
  });

  it("rejects malformed, mismatched and partial responses", async () => {
    const client = createProjectCloudClient("owner");
    mocks.rows = [{ project_id: "different", state: project, state_hash: "hash" }];
    await expect(client.load()).resolves.toEqual([
      { projectId: "different", reason: expect.stringContaining("invalid"), access },
    ]);
    mocks.rpc.mockResolvedValue({
      data: [{ result_saved: true, result_state: null, result_state_hash: "hash" }],
      error: null,
    });
    await expect(client.save(project, "next", null)).rejects.toThrow("invalid");
  });
});
