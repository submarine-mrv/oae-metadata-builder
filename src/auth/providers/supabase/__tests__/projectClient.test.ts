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
  eq: vi.fn(),
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
      from: () => ({
        select: () => ({
          eq: async (...args: unknown[]) => {
            mocks.eq(...args);
            await options.accessToken();
            return { data: mocks.rows, error: mocks.loadError };
          },
        }),
      }),
      rpc: async (...args: unknown[]) => {
        await options.accessToken();
        return mocks.rpc(...args);
      },
    };
  },
}));

import { createProjectCloudClient } from "../projectClient";

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

  it("reads only the bound owner's project sessions", async () => {
    const client = createProjectCloudClient("owner");
    const rows = await client.load();
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(rows[0].project.id).toBe(project.id);
    expect(await mocks.options?.accessToken()).toBe("owner-token");
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

  it("rejects malformed, mismatched and partial responses", async () => {
    const client = createProjectCloudClient("owner");
    mocks.rows = [{ project_id: "different", state: project, state_hash: "hash" }];
    await expect(client.load()).rejects.toThrow("invalid");
    mocks.rpc.mockResolvedValue({
      data: [{ result_saved: true, result_state: null, result_state_hash: "hash" }],
      error: null,
    });
    await expect(client.save(project, "next", null)).rejects.toThrow("invalid");
  });
});
