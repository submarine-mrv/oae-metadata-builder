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

  it("manages members through the member RPCs", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ email: "bob@example.com", role: "editor" }],
      error: null,
    });
    const members = createProjectMembersClient("owner");
    expect(await members.list("p")).toEqual([{ email: "bob@example.com", role: "editor" }]);
    await members.set("p", "bob@example.com", "viewer");
    expect(mocks.rpc).toHaveBeenCalledWith("set_metadata_builder_project_member", {
      p_project_id: "p",
      p_email: "bob@example.com",
      p_role: "viewer",
    });
    await members.remove("p", "bob@example.com");
    expect(mocks.rpc).toHaveBeenCalledWith("remove_metadata_builder_project_member", {
      p_project_id: "p",
      p_email: "bob@example.com",
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
