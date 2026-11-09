import { createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import {
  type ProjectAccess,
  ProjectAccessError,
  type ProjectCloudClient,
  startProjectCloudSync,
} from "../projectCloudSync";
import { SHARED_REFRESH_INTERVAL_MS } from "../projectCloudSync/project";
import { projectAccessAtom, projectSyncStatusAtom, remoteDeletionsAtom } from "../syncState";
import { emptyProjectState, newProjectRecord, type ProjectRecord } from "../types";
import { updateProject } from "../workspace";

const access = (role: ProjectAccess["role"], memberCount = 0): ProjectAccess => ({
  role,
  ownerEmail: "owner@example.com",
  updatedByEmail: null,
  memberCount,
});

function project(name = "one"): ProjectRecord {
  return {
    ...newProjectRecord({ ...emptyProjectState(), projectData: { name } }, 100),
    id: "one",
  };
}

function fakeClient(role: ProjectAccess["role"], memberCount = 0) {
  const rows = new Map([
    ["one", { project: project(), hash: "h1", access: access(role, memberCount) }],
  ]);
  const client: ProjectCloudClient = {
    load: vi.fn(async () => [...rows.values()]),
    hashes: vi.fn(
      async () =>
        new Map([...rows].map(([id, row]) => [id, { hash: row.hash, access: row.access }])),
    ),
    save: vi.fn(async (record, hash) => {
      const row = rows.get(record.id);
      if (row) rows.set(record.id, { ...row, project: record, hash });
      return { saved: true, project: record, hash };
    }),
    remove: vi.fn(async () => ({ saved: true, project: null, hash: null })),
  };
  return { client, rows };
}

describe("project roles in cloud sync", () => {
  let stop = () => {};
  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(role: ProjectAccess["role"], memberCount = 0) {
    const store = createStore();
    const { client, rows } = fakeClient(role, memberCount);
    const sync = startProjectCloudSync(store, client);
    stop = sync.stop;
    await sync.load();
    const edit = (name: string) => {
      const record = store.get(workspaceAtom).projects[0];
      store.set(workspaceAtom, (workspace) =>
        updateProject(workspace, record.id, {
          ...record.state,
          projectData: { ...record.state.projectData, name },
        }),
      );
    };
    return { store, client, rows, sync, edit };
  }

  it("records each project's access on load", async () => {
    const { store } = await setup("editor", 2);
    expect(store.get(projectAccessAtom).one).toEqual(access("editor", 2));
  });

  it("never saves a project the user can only view", async () => {
    const { client, sync, edit } = await setup("viewer");
    edit("typed by a viewer");
    await sync.flush();
    expect(client.save).not.toHaveBeenCalled();
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it("gives a viewer the newer copy even over local changes", async () => {
    const { rows, store, sync, edit } = await setup("viewer");
    edit("viewer's stray change");
    rows.set("one", { project: project("from the owner"), hash: "h2", access: access("viewer") });
    await sync.refresh();
    expect(store.get(workspaceAtom).projects[0].state.projectData.name).toBe("from the owner");
  });

  it("picks up a role change on refresh without reloading the draft", async () => {
    const { client, rows, store, sync } = await setup("editor");
    const row = rows.get("one");
    if (!row) throw new Error("missing row");
    rows.set("one", { ...row, access: access("viewer") });
    await sync.refresh();
    expect(store.get(projectAccessAtom).one.role).toBe("viewer");
    expect(client.load).toHaveBeenCalledOnce();
  });

  it("treats losing access like a remote delete, with its own reason", async () => {
    const { rows, store, sync } = await setup("editor");
    rows.delete("one");
    await sync.refresh();
    expect(store.get(workspaceAtom).projects).toEqual([]);
    expect(store.get(remoteDeletionsAtom)).toEqual([
      { type: "project", name: "one", projectId: "one", reason: "access" },
    ]);
  });

  it("shows a refused save as an error that retrying can't fix", async () => {
    const { client, store, sync, edit } = await setup("editor");
    vi.mocked(client.save).mockRejectedValueOnce(new ProjectAccessError("one"));
    edit("after losing edit access");
    await expect(sync.flush()).rejects.toThrow("no longer edit");
    expect(store.get(projectSyncStatusAtom)).toMatchObject({ state: "error", noRetry: true });
  });

  it("checks a shared project every 10 seconds and a private one every minute", async () => {
    vi.useFakeTimers();
    const shared = await setup("owner", 1);
    await vi.advanceTimersByTimeAsync(SHARED_REFRESH_INTERVAL_MS * 3);
    expect(shared.client.hashes).toHaveBeenCalledTimes(3);
    stop();

    const solo = await setup("owner", 0);
    await vi.advanceTimersByTimeAsync(SHARED_REFRESH_INTERVAL_MS * 3);
    expect(solo.client.hashes).not.toHaveBeenCalled();
  });
});
