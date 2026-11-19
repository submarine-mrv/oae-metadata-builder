import { createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { type ProjectCloudClient, startProjectCloudSync } from "../projectCloudSync";
import { SlugConflictError } from "../slugConflicts";
import { projectSlugConflictsAtom, projectSyncStatusAtom } from "../syncState";
import { emptyProjectState, newProjectRecord, type ProjectRecord } from "../types";
import { updateProject } from "../workspace";

// Web Crypto resolves outside the fake clock; a microtask hash keeps retry timing deterministic.
vi.mock("../projectCloudSync/helper", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../projectCloudSync/helper")>()),
  hashProject: async (record: ProjectRecord) =>
    `hash-${record.updatedAt}-${record.state.projectData.name}`,
}));

function project(id = "one"): ProjectRecord {
  return {
    ...newProjectRecord({ ...emptyProjectState(), projectData: { project_id: id, name: id } }, 100),
    id,
  };
}

function clientWith(projects: ProjectRecord[]) {
  const rows = new Map(projects.map((record) => [record.id, { project: record, hash: record.id }]));
  const client: ProjectCloudClient = {
    load: vi.fn(async () => [...rows.values()]),
    hashes: vi.fn(async () => new Map([...rows].map(([id, row]) => [id, { hash: row.hash }]))),
    save: vi.fn(async (record, hash, expected) => {
      const current = rows.get(record.id);
      if ((current?.hash ?? null) !== expected) {
        return { saved: false, project: current?.project ?? null, hash: current?.hash ?? null };
      }
      rows.set(record.id, { project: record, hash });
      return { saved: true, project: record, hash };
    }),
    remove: vi.fn(async () => ({ saved: true, project: null, hash: null })),
  };
  return { client, rows };
}

describe("automatic sync retries", () => {
  let stop = () => {};
  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup() {
    vi.useFakeTimers();
    const store = createStore();
    const { client, rows } = clientWith([project()]);
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

  it("retries a failed request on its own after a backoff", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const { client, store, sync, edit } = await setup();
    edit("unsaved");
    vi.mocked(client.save).mockRejectedValueOnce(new Error("network failed"));
    await expect(sync.flush()).rejects.toThrow("network failed");
    expect(store.get(projectSyncStatusAtom).state).toBe("pending");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(client.save).toHaveBeenCalledTimes(2);
    expect(sync.hasPendingChanges()).toBe(false);
    expect(store.get(projectSyncStatusAtom).state).toBe("synced");
  });

  it("holds new edits until the scheduled retry instead of the shorter save delay", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const { client, sync, edit } = await setup();
    edit("unsaved");
    vi.mocked(client.save).mockRejectedValueOnce(new Error("network failed"));
    await expect(sync.flush()).rejects.toThrow("network failed");
    edit("more edits");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(client.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(client.save).toHaveBeenCalledTimes(2);
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it("shows a plain-language error only after failing for 30 seconds", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const { client, store, sync, edit } = await setup();
    edit("unsaved");
    vi.mocked(client.save).mockRejectedValue(new Error("network failed"));
    await expect(sync.flush()).rejects.toThrow("network failed");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(store.get(projectSyncStatusAtom).state).toBe("pending");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(store.get(projectSyncStatusAtom)).toMatchObject({
      state: "error",
      message: expect.stringContaining("Can't save right now"),
    });
    expect(sync.hasPendingChanges()).toBe(true);
  });

  it("retries contention after a short random delay instead of failing", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { client, rows, store, sync, edit } = await setup();
    for (let round = 0; round < 4; round++) {
      vi.mocked(client.save).mockResolvedValueOnce({
        saved: false,
        project: project(),
        hash: `changed-${round}`,
      });
    }
    edit("local");
    await expect(sync.flush()).rejects.toThrow("keeps changing");
    expect(store.get(projectSyncStatusAtom).state).toBe("pending");
    rows.set("one", { project: project(), hash: "changed-3" });
    await vi.advanceTimersByTimeAsync(500);
    expect(client.save).toHaveBeenCalledTimes(5);
    expect(rows.get("one")?.project.state.projectData.name).toBe("local");
  });

  it("does not retry a real conflict on its own", async () => {
    const { client, store, sync, edit } = await setup();
    const remote = project();
    remote.state = {
      ...remote.state,
      projectData: { ...remote.state.projectData, name: "theirs" },
    };
    vi.mocked(client.save).mockResolvedValueOnce({ saved: false, project: remote, hash: "theirs" });
    edit("mine");
    await expect(sync.flush()).rejects.toThrow("Newer changes also edited");
    expect(store.get(projectSyncStatusAtom).state).toBe("error");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(client.save).toHaveBeenCalledTimes(1);
  });

  it("keeps duplicate edits unsynced without retrying, then recovers when the ID is cleared", async () => {
    const { client, store, sync, edit } = await setup();
    const conflicts = [{ entityType: "project" as const, entityId: "one", slug: "one" }];
    vi.mocked(client.save).mockRejectedValueOnce(new SlugConflictError("one", conflicts));
    edit("unsaved");
    await expect(sync.flush()).rejects.toBeInstanceOf(SlugConflictError);
    expect(store.get(projectSyncStatusAtom)).toMatchObject({ state: "error", noRetry: true });
    expect(store.get(projectSlugConflictsAtom).one).toEqual(conflicts);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(sync.hasPendingChanges()).toBe(true);

    store.set(workspaceAtom, (workspace) => ({
      ...workspace,
      projects: workspace.projects.map((record) => ({
        ...record,
        state: { ...record.state, projectData: { ...record.state.projectData, project_id: "" } },
      })),
    }));
    await sync.flush();
    expect(store.get(projectSlugConflictsAtom).one).toEqual([]);
    expect(store.get(projectSyncStatusAtom).state).toBe("synced");
  });

  it("blocks known cross-project/type duplicates while other projects still save", async () => {
    const { client, store, sync } = await setup();
    const duplicate = project("two");
    duplicate.state.experiments = [
      {
        id: "exp-two",
        name: "Duplicate",
        formData: { experiment_id: "one" },
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const healthy = project("three");
    store.set(workspaceAtom, (workspace) => ({
      ...workspace,
      projects: [...workspace.projects, duplicate, healthy],
    }));
    await expect(sync.flush()).rejects.toBeInstanceOf(SlugConflictError);
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(client.save).mock.calls[0][0].id).toBe("three");
    expect(store.get(projectSlugConflictsAtom).two).toEqual([
      { entityType: "experiment", entityId: "exp-two", slug: "one" },
    ]);
  });

  it("shows legacy conflicts on load and clears them after a hash-only refresh", async () => {
    vi.useFakeTimers();
    const store = createStore();
    const { client } = clientWith([project()]);
    vi.mocked(client.load).mockResolvedValueOnce([
      {
        project: project(),
        hash: "one",
        slugConflicts: [{ entityType: "project", entityId: "one", slug: "one" }],
      },
    ]);
    const sync = startProjectCloudSync(store, client);
    stop = sync.stop;
    await sync.load();
    expect(store.get(projectSyncStatusAtom)).toMatchObject({ state: "error", noRetry: true });
    expect(store.get(projectSlugConflictsAtom).one).toHaveLength(1);
    await expect(sync.flush()).rejects.toBeInstanceOf(SlugConflictError);
    await sync.refresh();
    expect(store.get(projectSlugConflictsAtom).one).toEqual([]);
    expect(store.get(projectSyncStatusAtom).state).toBe("synced");
  });

  it("clears a slug error when its project is deleted", async () => {
    const { client, store, sync, edit } = await setup();
    vi.mocked(client.save).mockRejectedValue(
      new SlugConflictError("one", [{ entityType: "project", entityId: "one", slug: "one" }]),
    );
    edit("unsynced");
    await expect(sync.flush()).rejects.toBeInstanceOf(SlugConflictError);
    await sync.remove("one");
    expect(store.get(projectSlugConflictsAtom).one).toEqual([]);
    expect(store.get(projectSyncStatusAtom).state).toBe("synced");
  });
});
