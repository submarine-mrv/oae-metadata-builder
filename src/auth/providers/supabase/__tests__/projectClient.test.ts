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

import {
  PROTOCOL_SCHEMA_VERSION,
  ProjectAccessError,
  parseCloudProject,
  type RemoteProject,
} from "@/workspace/projectCloudSync";
import type { ProjectRecord } from "@/workspace/types";
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

const PROJECT = "7d4e6f2a-1b3c-4d5e-8f60-718293a4b5c6";
const EXPERIMENT = "0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3";
const OTHER_EXPERIMENT = "1b2c3d4e-5f6a-4b7c-9d8e-9fa0b1c2d3e4";
const DATASET = "2c3d4e5f-6a7b-4c8d-ae9f-a0b1c2d3e4f5";
const V = PROTOCOL_SCHEMA_VERSION;

const entity = (id: string, name: string) => ({
  id,
  name,
  formData: {},
  createdAt: 100,
  updatedAt: 100,
});

/** A project as parsing the cloud copy yields it, so loads compare equal. */
const project: ProjectRecord = parseCloudProject(
  {
    ...newProjectRecord(emptyProjectState(), 100),
    id: PROJECT,
    state: {
      ...emptyProjectState(),
      experiments: [entity(EXPERIMENT, "Site A"), entity(OTHER_EXPERIMENT, "Site B")],
      datasets: [
        { ...entity(DATASET, "Cast"), linking: { linkedExperimentInternalId: EXPERIMENT } },
      ],
    },
  },
  PROJECT,
);

const hashes = {
  project: "project-hash",
  [EXPERIMENT]: "experiment-hash",
  [OTHER_EXPERIMENT]: "other-experiment-hash",
  [DATASET]: "dataset-hash",
};

/** The `state` the list RPC and conflict responses carry for a record. */
function cloudState(record: ProjectRecord) {
  const row = (item: { id: string; name: string; formData: unknown }) => ({
    uuid: item.id,
    name: item.name,
    form_data: item.formData,
    content_hash: `${item.id}-hash`,
    created_at: 100,
    updated_at: 100,
  });
  return {
    project: {
      form_data: record.state.projectData,
      content_hash: "project-hash",
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    },
    experiments: record.state.experiments.map(row),
    datasets: record.state.datasets.map((dataset) => ({
      ...row(dataset),
      experiment_uuid: dataset.linking?.linkedExperimentInternalId ?? null,
    })),
  };
}

const listRow = (overrides: Record<string, unknown> = {}) => ({
  project_uuid: PROJECT,
  project_hash: "hash",
  schema_version: V,
  state: cloudState(project),
  ...overrides,
});

const saved = (status = "saved", state: unknown = null) => ({
  data: [
    {
      result_status: status,
      result_project_hash: "next",
      result_hashes: hashes,
      result_state: state,
    },
  ],
  error: null,
});

const base: RemoteProject = { project, hash: "hash", rows: hashes, schemaVersion: V };

describe("owner-bound project Supabase client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [listRow()];
    mocks.loadError = null;
    mocks.session = { user: { id: "owner" }, access_token: "owner-token" };
    mocks.rpc.mockResolvedValue(saved());
  });

  it("reads owned and shared projects with the caller's access through one RPC", async () => {
    const client = createProjectCloudClient("owner");
    const rows = await client.load();
    expect(mocks.list).toHaveBeenCalledWith({ p_include_state: true });
    expect(rows).toEqual([
      {
        project,
        hash: "hash",
        rows: {
          project: "project-hash",
          [EXPERIMENT]: `${EXPERIMENT}-hash`,
          [OTHER_EXPERIMENT]: `${OTHER_EXPERIMENT}-hash`,
          [DATASET]: `${DATASET}-hash`,
        },
        schemaVersion: V,
        access,
      },
    ]);
    expect(await mocks.options?.accessToken()).toBe("owner-token");
  });

  it("checks hashes and access without loading state", async () => {
    mocks.rows = [listRow({ state: null, role: "viewer" })];
    const versions = await createProjectCloudClient("owner").hashes();
    expect(mocks.list).toHaveBeenCalledWith({ p_include_state: false });
    expect(versions.get(PROJECT)).toEqual({
      hash: "hash",
      access: { ...access, role: "viewer" },
    });
  });

  it("rejects rows with an unknown role", async () => {
    mocks.rows = [listRow({ role: "admin" })];
    await expect(createProjectCloudClient("owner").load()).rejects.toThrow("invalid");
  });

  it("reports a refused save as lost edit access", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied", code: "42501" } });
    await expect(createProjectCloudClient("owner").save(project, null)).rejects.toThrow(
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
      p_project_uuid: "p",
      p_user_id: "bob",
      p_role: "viewer",
    });
    await members.remove("p", "bob");
    expect(mocks.rpc).toHaveBeenCalledWith("remove_metadata_builder_project_member", {
      p_project_uuid: "p",
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

  it("rewrites every row on a project's first save", async () => {
    const result = await createProjectCloudClient("owner").save(project, null);
    expect(mocks.rpc).toHaveBeenCalledWith("save_metadata_builder_project", {
      p_project_uuid: PROJECT,
      p_schema_version: V,
      p_expected_project_hash: null,
      p_project: {
        form_data: project.state.projectData,
        created_at: 100,
        updated_at: 100,
        base_hash: null,
      },
      p_experiments: [
        {
          uuid: EXPERIMENT,
          position: 0,
          name: "Site A",
          form_data: {},
          created_at: 100,
          updated_at: 100,
        },
        {
          uuid: OTHER_EXPERIMENT,
          position: 1,
          name: "Site B",
          form_data: {},
          created_at: 100,
          updated_at: 100,
        },
      ],
      p_datasets: [
        {
          uuid: DATASET,
          experiment_uuid: EXPERIMENT,
          position: 0,
          name: "Cast",
          form_data: project.state.datasets[0].formData,
          created_at: 100,
          updated_at: 100,
        },
      ],
      p_replace: true,
    });
    expect(result).toEqual({ saved: true, project, hash: "next", rows: hashes, schemaVersion: V });
  });

  it("sends only changed rows with their base hashes, and deletions", async () => {
    const edited: ProjectRecord = {
      ...project,
      state: {
        ...project.state,
        experiments: project.state.experiments.map((experiment) =>
          experiment.id === EXPERIMENT ? { ...experiment, name: "Site A edited" } : experiment,
        ),
        datasets: [],
      },
    };
    await createProjectCloudClient("owner").save(edited, base);
    expect(mocks.rpc).toHaveBeenCalledWith("save_metadata_builder_project", {
      p_project_uuid: PROJECT,
      p_schema_version: V,
      p_expected_project_hash: "hash",
      p_project: null,
      p_experiments: [
        {
          uuid: EXPERIMENT,
          position: 0,
          name: "Site A edited",
          form_data: {},
          created_at: 100,
          updated_at: 100,
          base_hash: "experiment-hash",
        },
      ],
      p_datasets: [{ uuid: DATASET, base_hash: "dataset-hash", deleted: true }],
      p_replace: false,
    });
  });

  it("acknowledges an unchanged project without a request", async () => {
    await expect(createProjectCloudClient("owner").save(project, base)).resolves.toEqual({
      saved: true,
      project,
      hash: "hash",
      rows: hashes,
      schemaVersion: V,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rewrites a copy saved under an older protocol version", async () => {
    const edited = { ...project, updatedAt: 200 };
    await createProjectCloudClient("owner").save(edited, { ...base, schemaVersion: "0.0.1" });
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_expected_project_hash: "hash",
      p_replace: true,
    });
  });

  it("retries once as a rewrite when the cloud copy needs upgrading", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "upgrade", details: "metadata_builder_schema_upgrade_required" },
      })
      .mockResolvedValueOnce(saved());
    const edited = { ...project, updatedAt: 200 };
    await expect(createProjectCloudClient("owner").save(edited, base)).resolves.toMatchObject({
      saved: true,
      hash: "next",
    });
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_replace)).toEqual([false, true]);
  });

  it("returns the combined cloud copy when the server merged the save", async () => {
    const combined: ProjectRecord = {
      ...project,
      state: {
        ...project.state,
        experiments: project.state.experiments.map((experiment) =>
          experiment.id === OTHER_EXPERIMENT
            ? { ...experiment, name: "Site B theirs" }
            : experiment,
        ),
      },
    };
    mocks.rpc.mockResolvedValue(saved("merged", cloudState(combined)));
    const edited = { ...project, updatedAt: 200 };
    const result = await createProjectCloudClient("owner").save(edited, base);
    expect(result).toMatchObject({ saved: true, merged: true, hash: "next", schemaVersion: V });
    expect(result.project?.state.experiments.map((experiment) => experiment.name)).toEqual([
      "Site A",
      "Site B theirs",
    ]);
  });

  it("returns the cloud copy on a conflict without saving", async () => {
    mocks.rpc.mockResolvedValue(saved("conflict", cloudState(project)));
    const result = await createProjectCloudClient("owner").save(
      { ...project, updatedAt: 200 },
      base,
    );
    expect(result).toMatchObject({ saved: false, hash: "next", project: { id: PROJECT } });
    expect(result.merged).toBeUndefined();
  });

  it("reports future projects without parsing their state or hiding supported projects", async () => {
    mocks.rows.push(
      listRow({
        project_uuid: "future",
        project_hash: "future-hash",
        schema_version: "99.0.0",
        state: { futureField: true },
      }),
    );
    const rows = await createProjectCloudClient("owner").load();
    expect(rows[1]).toEqual({ projectId: "future", schemaVersion: "99.0.0", access });
    expect(rows[0]).toMatchObject({ project: { id: PROJECT } });
  });

  it("rejects newer local formats before sending a write", async () => {
    await expect(
      createProjectCloudClient("owner").save({ ...project, schemaVersion: 3 }, base),
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
    await expect(
      createProjectCloudClient("owner").save({ ...project, updatedAt: 200 }, base),
    ).rejects.toThrow("Reload");
  });

  it("explains an entity UUID saved in another project", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "taken", details: "metadata_builder_entity_uuid_taken" },
    });
    await expect(createProjectCloudClient("owner").save(project, null)).rejects.toThrow(
      "Duplicate the project",
    );
  });

  it("deletes only the requested project and expected revision", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result_status: "deleted",
          result_project_hash: null,
          result_hashes: null,
          result_state: null,
        },
      ],
      error: null,
    });
    const result = await createProjectCloudClient("owner").remove(PROJECT, "previous");
    expect(result).toEqual({ saved: true, project: null, hash: null });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_metadata_builder_project", {
      p_project_uuid: PROJECT,
      p_expected_project_hash: "previous",
    });
  });

  it("refuses to delete a published project", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "published", details: "metadata_builder_project_published" },
    });
    await expect(createProjectCloudClient("owner").remove(PROJECT, "hash")).rejects.toThrow(
      "Unpublish it",
    );
  });

  it("rejects account changes before sending writes with a different token", async () => {
    const client = createProjectCloudClient("owner");
    mocks.session = { user: { id: "other" }, access_token: "other-token" };
    await expect(client.save(project, null)).rejects.toThrow("account changed");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.session = null;
    await expect(client.load()).rejects.toThrow("account changed");
  });

  it("surfaces query and RPC errors instead of claiming success", async () => {
    const client = createProjectCloudClient("owner");
    mocks.loadError = { message: "no read access" };
    await expect(client.load()).rejects.toThrow("no read access");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "save denied" } });
    await expect(client.save(project, null)).rejects.toThrow("save denied");
  });

  it("keeps a committed save even when the echoed state would fail client validation", async () => {
    mocks.rpc.mockResolvedValue(saved("saved", { project: { nextExperimentId: 0 } }));
    await expect(createProjectCloudClient("owner").save(project, null)).resolves.toMatchObject({
      saved: true,
      hash: "next",
      project,
    });
  });

  it("rejects malformed, mismatched and partial responses", async () => {
    const client = createProjectCloudClient("owner");
    mocks.rows = [listRow({ state: { project: {} } })];
    await expect(client.load()).resolves.toEqual([
      { projectId: PROJECT, reason: expect.stringContaining("invalid"), access },
    ]);
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result_status: "saved",
          result_project_hash: null,
          result_hashes: null,
          result_state: null,
        },
      ],
      error: null,
    });
    await expect(client.save(project, null)).rejects.toThrow("invalid");
    mocks.rpc.mockResolvedValue({
      data: [{ result_status: "bogus", result_project_hash: "x", result_hashes: {} }],
      error: null,
    });
    await expect(client.save(project, null)).rejects.toThrow("invalid");
  });
});
