import { createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { type ProjectCloudClient, startProjectCloudSync } from "../projectCloudSync";
import { projectSyncStatusAtom } from "../syncState";
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
      message: expect.stringContaining("Can't reach the cloud right now"),
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
    await expect(sync.flush()).rejects.toThrow("Conflicting changes");
    expect(store.get(projectSyncStatusAtom).state).toBe("error");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(client.save).toHaveBeenCalledTimes(1);
  });
});
