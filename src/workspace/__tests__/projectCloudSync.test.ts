import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { SAVE_DEBOUNCE_MS } from "@/state/persistence";
import {
  type ProjectCloudClient,
  type ProjectSaveResult,
  parseCloudProject,
  startProjectCloudSync,
} from "../projectCloudSync";
import { WORKSPACE_KEY } from "../storage";
import { projectSyncStatusAtom } from "../syncState";
import { emptyProjectState, newProjectRecord, type ProjectRecord } from "../types";
import { addProject, deleteProject, switchProject, updateProject } from "../workspace";

function project(id = "one"): ProjectRecord {
  return {
    ...newProjectRecord({ ...emptyProjectState(), projectData: { project_id: id, name: id } }, 100),
    id,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function clientWith(projects: ProjectRecord[] = []) {
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
    remove: vi.fn(async (id, expected) => {
      const current = rows.get(id);
      if ((current?.hash ?? null) !== expected) {
        return { saved: false, project: current?.project ?? null, hash: current?.hash ?? null };
      }
      rows.delete(id);
      return { saved: true, project: null, hash: null };
    }),
  };
  return { client, rows };
}

describe("project cloud synchronization", () => {
  let stop = () => {};
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(projects = [project()]) {
    const store = createStore();
    const { client, rows } = clientWith(projects);
    const sync = startProjectCloudSync(store, client);
    stop = sync.stop;
    await sync.load();
    const edit = (name: string, id = "one") => {
      const record = store.get(workspaceAtom).projects.find((item) => item.id === id);
      if (!record) throw new Error("Missing test project");
      store.set(workspaceAtom, (workspace) =>
        updateProject(workspace, id, {
          ...record.state,
          projectData: { ...record.state.projectData, name },
        }),
      );
    };
    return { store, client, rows, sync, edit };
  }

  it("loads privately without uploading or touching local project storage", async () => {
    localStorage.setItem(WORKSPACE_KEY, "guest sentinel");
    const { store, client, sync } = await setup();
    expect(store.get(workspaceAtom).projects).toHaveLength(1);
    await sync.flush();
    expect(client.save).not.toHaveBeenCalled();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe("guest sentinel");
  });

  it("saves only the changed project and ignores selection-only changes", async () => {
    const { store, client, sync, edit } = await setup([project(), project("two")]);
    store.set(workspaceAtom, (workspace) => switchProject(workspace, "two"));
    await sync.flush();
    expect(client.save).not.toHaveBeenCalled();
    edit("edited", "two");
    await sync.flush();
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(client.save).mock.calls[0][0].id).toBe("two");
    expect(vi.mocked(client.save).mock.calls[0][2]).toBe("two");
  });

  it("debounces edits and saves from the Jotai snapshot", async () => {
    vi.useFakeTimers();
    const { client, sync, edit } = await setup();
    edit("first");
    edit("latest");
    expect(client.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    await sync.flush();
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(client.save).mock.calls[0][0].state.projectData.name).toBe("latest");
  });

  it("keeps edits made during an in-flight save queued until acknowledged", async () => {
    const { store, client, rows, sync, edit } = await setup();
    const response = deferred<ProjectSaveResult>();
    vi.mocked(client.save).mockImplementationOnce(() => response.promise);
    edit("first");
    const saving = sync.flush();
    await vi.waitFor(() => expect(client.save).toHaveBeenCalledTimes(1));
    edit("second");
    rows.set("one", { project: vi.mocked(client.save).mock.calls[0][0], hash: "first-hash" });
    response.resolve({ saved: true, project: project(), hash: "first-hash" });
    await saving;
    expect(client.save).toHaveBeenCalledTimes(2);
    expect(vi.mocked(client.save).mock.calls[1][0].state.projectData.name).toBe("second");
    expect(store.get(projectSyncStatusAtom).state).toBe("synced");
  });

  it("retains failures in memory and retries without a local recovery copy", async () => {
    const { client, store, sync, edit } = await setup();
    edit("unsaved");
    vi.mocked(client.save).mockRejectedValueOnce(new Error("network failed"));
    await expect(sync.flush()).rejects.toThrow("network failed");
    expect(store.get(projectSyncStatusAtom).state).toBe("pending");
    expect(sync.hasPendingChanges()).toBe(true);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    await sync.flush();
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it("keeps offline edits in memory and retries when connectivity returns", async () => {
    const { store, sync, edit } = await setup();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    edit("offline");
    await expect(sync.flush()).rejects.toThrow("Offline");
    expect(store.get(projectSyncStatusAtom).state).toBe("error");
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await sync.flush();
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it("flushes on page hide and warns before leaving with pending edits", async () => {
    const { sync, edit } = await setup();
    edit("hidden");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    window.dispatchEvent(new Event("pagehide"));
    await sync.flush();
    expect(sync.hasPendingChanges()).toBe(false);
    const cleanExit = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanExit);
    expect(cleanExit.defaultPrevented).toBe(false);
  });

  it("merges a conflicting project and retries using the remote hash", async () => {
    const { store, rows, client, sync, edit } = await setup();
    rows.set("one", {
      project: {
        ...project(),
        state: {
          ...emptyProjectState(),
          projectData: { project_id: "one", name: "one", description: "remote" },
        },
      },
      hash: "remote",
    });
    edit("local");
    await sync.flush();
    expect(client.save).toHaveBeenCalledTimes(2);
    expect(vi.mocked(client.save).mock.calls[1][2]).toBe("remote");
    expect(store.get(workspaceAtom).projects[0].state.projectData).toMatchObject({
      name: "local",
      description: "remote",
    });
  });

  it("surfaces a remotely deleted project instead of silently recreating it", async () => {
    const { rows, sync, edit } = await setup();
    rows.delete("one");
    edit("keep me");
    await expect(sync.flush()).rejects.toThrow("deleted on another device");
    expect(sync.hasPendingChanges()).toBe(true);
  });

  it("bounds retries for repeatedly conflicting saves", async () => {
    const { client, sync, edit } = await setup();
    vi.mocked(client.save).mockResolvedValue({ saved: false, project: project(), hash: "changed" });
    edit("local");
    await expect(sync.flush()).rejects.toThrow("keeps changing");
    expect(client.save).toHaveBeenCalledTimes(4);
  });

  it("saves new projects separately and deletes only the selected remote row", async () => {
    const { store, rows, sync, client } = await setup();
    store.set(workspaceAtom, (workspace) => addProject(workspace, project("two")));
    await sync.flush();
    await sync.remove("one");
    store.set(workspaceAtom, (workspace) => deleteProject(workspace, "one"));
    await sync.flush();
    expect([...rows.keys()]).toEqual(["two"]);
    expect(client.remove).toHaveBeenCalledWith("one", "one");
    expect(client.save).toHaveBeenCalledTimes(1);
  });

  it("does not delete a project changed on another device", async () => {
    const { rows, store, sync } = await setup();
    rows.set("one", { project: project(), hash: "changed" });
    await expect(sync.remove("one")).rejects.toThrow("changed on another device");
    expect(store.get(workspaceAtom).projects).toHaveLength(1);
  });

  it("does not upload local projects until explicit migration", async () => {
    const local = project("local");
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({
        version: 1,
        activeProjectId: local.id,
        projects: [local],
      }),
    );
    const { rows, sync, store } = await setup();
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual(["one"]);
    expect(rows.has("local")).toBe(false);
    await sync.migrateLocalProjects();
    expect(rows.has("local")).toBe(true);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects).toEqual([]);
  });

  it("keeps failed migration sources and resumes after partial success", async () => {
    const originals = [project("local"), project("second")];
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({
        version: 1,
        activeProjectId: "local",
        projects: originals,
      }),
    );
    const { client, sync, rows } = await setup([]);
    const save = vi.mocked(client.save).getMockImplementation();
    if (!save) throw new Error("Missing test save implementation");
    vi.mocked(client.save).mockImplementationOnce(save).mockRejectedValueOnce(new Error("failed"));
    await expect(sync.migrateLocalProjects()).rejects.toThrow("failed");
    expect(rows.has("local")).toBe(true);
    expect(
      JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects.map(
        (record: ProjectRecord) => record.id,
      ),
    ).toEqual(["second"]);
    await sync.migrateLocalProjects();
    expect(rows.has("second")).toBe(true);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects).toEqual([]);
  });

  it("retains local edits made by another tab while migration is in flight", async () => {
    const local = project("local");
    const guest = { version: 1, activeProjectId: local.id, projects: [local] };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(guest));
    const { sync, client } = await setup([]);
    const save = vi.mocked(client.save).getMockImplementation();
    if (!save) throw new Error("Missing test save implementation");
    vi.mocked(client.save).mockImplementationOnce(async (...args) => {
      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify({
          ...guest,
          projects: [{ ...local, updatedAt: 999 }],
        }),
      );
      return save(...args);
    });
    await expect(sync.migrateLocalProjects()).rejects.toThrow("changed during migration");
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects[0].updatedAt).toBe(999);
  });

  it("stops an old account's in-flight result from changing the current store", async () => {
    const { client, store, sync, edit } = await setup();
    const result = deferred<ProjectSaveResult>();
    vi.mocked(client.save).mockImplementationOnce(() => result.promise);
    edit("account A");
    const saving = sync.flush();
    await vi.waitFor(() => expect(client.save).toHaveBeenCalled());
    sync.stop();
    store.set(workspaceAtom, { version: 1, activeProjectId: "B", projects: [project("B")] });
    result.resolve({ saved: false, project: project(), hash: "stale-A" });
    await expect(saving).rejects.toThrow("account changed");
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual(["B"]);
  });

  it("sets aside an unreadable cloud row and still loads and saves the rest", async () => {
    const store = createStore();
    const { client } = clientWith([project("two")]);
    vi.mocked(client.load).mockResolvedValue([
      { projectId: "broken", reason: "The cloud project has an invalid or unsupported format." },
      { project: project("two"), hash: "two" },
    ]);
    const sync = startProjectCloudSync(store, client);
    stop = sync.stop;
    await sync.load();
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual(["two"]);
    expect(store.get(projectSyncStatusAtom)).toMatchObject({
      state: "error",
      message: expect.stringContaining('Project "broken" could not be read'),
    });
    const record = store.get(workspaceAtom).projects[0];
    store.set(workspaceAtom, (workspace) =>
      updateProject(workspace, "two", {
        ...record.state,
        projectData: { ...record.state.projectData, name: "edited" },
      }),
    );
    await sync.flush();
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(client.remove).not.toHaveBeenCalled();
  });

  it("drops a deleted project locally as soon as the cloud confirms", async () => {
    const { store, rows, sync, client } = await setup([project(), project("two")]);
    await sync.remove("one");
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual(["two"]);
    expect([...rows.keys()]).toEqual(["two"]);
    await sync.flush();
    expect(client.save).not.toHaveBeenCalled();
  });

  it("rejects malformed or mismatched cloud records", () => {
    expect(() => parseCloudProject({})).toThrow("invalid");
    expect(() => parseCloudProject(project(), "other")).toThrow("invalid");
    expect(() =>
      parseCloudProject({
        ...project(),
        state: { ...emptyProjectState(), nextDatasetId: -1 },
      }),
    ).toThrow("invalid");
  });
});
