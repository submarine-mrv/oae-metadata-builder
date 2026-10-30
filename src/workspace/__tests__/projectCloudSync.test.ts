import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { SAVE_DEBOUNCE_MS } from "@/state/persistence";
import {
  PROJECT_REFRESH_INTERVAL_MS,
  type ProjectCloudClient,
  type ProjectSaveResult,
  parseCloudProject,
  startProjectCloudSync,
} from "../projectCloudSync";
import { LEGACY_SESSION_KEY, WORKSPACE_KEY } from "../storage";
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

  it("pulls another window's updates without uploading clean snapshots or changing selection", async () => {
    const { store, client, rows, sync } = await setup([project(), project("two")]);
    store.set(workspaceAtom, (workspace) => switchProject(workspace, "two"));
    const unchanged = store.get(workspaceAtom).projects[1];
    rows.set("one", {
      project: {
        ...project(),
        state: { ...project().state, projectData: { name: "Remote edit" } },
      },
      hash: "remote",
    });
    await sync.refresh();
    expect(store.get(workspaceAtom).projects[0].state.projectData.name).toBe("Remote edit");
    expect(store.get(workspaceAtom).projects[1]).toBe(unchanged);
    expect(store.get(workspaceAtom).activeProjectId).toBe("two");
    await sync.flush();
    expect(client.save).not.toHaveBeenCalled();
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it("preserves all references on an unchanged refresh and never persists authenticated drafts locally", async () => {
    localStorage.setItem(WORKSPACE_KEY, "guest sentinel");
    const { sync, store, client } = await setup();
    const original = store.get(workspaceAtom);
    await sync.refresh();
    expect(store.get(workspaceAtom)).toBe(original);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe("guest sentinel");
    await sync.flush();
    expect(client.save).not.toHaveBeenCalled();
  });

  it("preserves local additions and pending local deletes while pulling remote additions", async () => {
    const { sync, rows, store } = await setup();
    store.set(workspaceAtom, (workspace) =>
      addProject(deleteProject(workspace, "one"), project("local")),
    );
    rows.set("remote", { project: project("remote"), hash: "remote" });
    await sync.refresh();
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual([
      "local",
      "remote",
    ]);
    expect(store.get(workspaceAtom).activeProjectId).toBe("local");
    await sync.flush();
    expect([...rows.keys()]).toEqual(["remote", "local"]);
  });

  it("does not restore or delete a locally deleted row that changed remotely", async () => {
    const { sync, rows, store, client } = await setup();
    store.set(workspaceAtom, (workspace) => deleteProject(workspace, "one"));
    rows.set("one", { project: project(), hash: "changed" });
    await expect(sync.refresh()).rejects.toThrow("changed on another device");
    expect(store.get(workspaceAtom).projects).toHaveLength(0);
    await expect(sync.flush()).rejects.toThrow("changed on another device");
    expect(client.remove).toHaveBeenCalledWith("one", "one");
    expect(rows.get("one")?.hash).toBe("changed");
  });

  it("validates the entire response before changing projects or acknowledged baselines", async () => {
    const { sync, client, store } = await setup();
    const original = store.get(workspaceAtom);
    vi.mocked(client.load).mockResolvedValueOnce([
      { project: project("two"), hash: "two" },
      { project: project("two"), hash: "duplicate" },
    ]);
    await expect(sync.refresh()).rejects.toThrow("duplicate project");
    expect(store.get(workspaceAtom)).toBe(original);
    vi.mocked(client.load).mockResolvedValueOnce([{ project: project(), hash: "" }]);
    await expect(sync.refresh()).rejects.toThrow("invalid project hash");
    expect(store.get(workspaceAtom)).toBe(original);
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it("updates two independent Jotai stores through their shared cloud", async () => {
    const { client, sync, edit } = await setup();
    const secondStore = createStore();
    const second = startProjectCloudSync(secondStore, client);
    try {
      await second.load();
      edit("From first window");
      await sync.flush();
      await second.refresh();
      expect(secondStore.get(workspaceAtom).projects[0].state.projectData.name).toBe(
        "From first window",
      );
      secondStore.set(workspaceAtom, (workspace) =>
        updateProject(workspace, "one", {
          ...workspace.projects[0].state,
          projectData: {
            ...workspace.projects[0].state.projectData,
            description: "From second window",
          },
        }),
      );
      await second.flush();
      await sync.refresh();
      expect(client.save).toHaveBeenCalledTimes(2);
    } finally {
      second.stop();
    }
  });

  it("merges disjoint edits received by refresh using the acknowledged baseline", async () => {
    const { rows, store, sync, edit } = await setup();
    edit("Local name");
    rows.set("one", {
      project: {
        ...project(),
        state: {
          ...project().state,
          projectData: { ...project().state.projectData, description: "Remote description" },
        },
      },
      hash: "remote",
    });
    await sync.refresh();
    expect(store.get(workspaceAtom).projects[0].state.projectData).toMatchObject({
      name: "Local name",
      description: "Remote description",
    });
    await sync.flush();
    expect(rows.get("one")?.project.state.projectData).toMatchObject({
      name: "Local name",
      description: "Remote description",
    });
  });

  it("retains overlapping edits and all baselines when refresh detects a conflict", async () => {
    const { rows, store, sync, client, edit } = await setup();
    edit("Local name");
    const local = store.get(workspaceAtom);
    rows.set("one", {
      project: {
        ...project(),
        state: { ...project().state, projectData: { name: "Remote name" } },
      },
      hash: "remote",
    });
    await expect(sync.refresh()).rejects.toThrow("Conflicting changes");
    expect(store.get(workspaceAtom)).toBe(local);
    expect(store.get(projectSyncStatusAtom).state).toBe("error");
    await expect(sync.flush()).rejects.toThrow("Conflicting changes");
    expect(vi.mocked(client.save).mock.calls[0][2]).toBe("one");
  });

  it("pulls remote additions and clean deletions without selecting a project from All projects", async () => {
    const { rows, store, sync, client } = await setup();
    store.set(workspaceAtom, (workspace) => ({ ...workspace, activeProjectId: null }));
    rows.delete("one");
    rows.set("two", { project: project("two"), hash: "two" });
    await sync.refresh();
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual(["two"]);
    expect(store.get(workspaceAtom).activeProjectId).toBeNull();
    await sync.flush();
    expect(client.save).not.toHaveBeenCalled();
    expect(client.remove).not.toHaveBeenCalled();
  });

  it("clears the selection when the active project was deleted remotely", async () => {
    const { rows, store, sync } = await setup();
    rows.delete("one");
    await sync.refresh();
    expect(store.get(workspaceAtom)).toEqual({ version: 1, activeProjectId: null, projects: [] });
  });

  it("never discards or recreates dirty projects deleted remotely", async () => {
    const { rows, store, sync, edit } = await setup();
    edit("Unsaved work");
    rows.delete("one");
    const snapshot = store.get(workspaceAtom);
    await expect(sync.refresh()).rejects.toThrow("deleted on another device");
    expect(store.get(workspaceAtom)).toBe(snapshot);
    await expect(sync.flush()).rejects.toThrow("deleted on another device");
    expect(rows.has("one")).toBe(false);
  });

  it("allows explicit per-project discard after remote deletion and unblocks other saves", async () => {
    const { rows, store, sync, edit, client } = await setup([project(), project("two")]);
    edit("Keep or export my draft");
    edit("Other project edit", "two");
    rows.delete("one");
    await expect(sync.refresh()).rejects.toThrow("deleted on another device");
    expect(store.get(projectSyncStatusAtom)).toMatchObject({ state: "error", projectId: "one" });
    await sync.discardProjectChanges("one");
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual(["two"]);
    await sync.flush();
    expect(rows.get("two")?.project.state.projectData.name).toBe("Other project edit");
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(rows.has("one")).toBe(false);
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it("takes the latest remote version only on explicit discard and retains other dirty drafts", async () => {
    const { rows, store, sync, edit } = await setup([project(), project("two")]);
    edit("Local conflict");
    edit("Other local edit", "two");
    rows.set("one", {
      project: {
        ...project(),
        state: { ...project().state, projectData: { name: "Remote winner" } },
      },
      hash: "remote",
    });
    await expect(sync.refresh()).rejects.toThrow("Conflicting changes");
    await sync.discardProjectChanges("one");
    expect(
      store.get(workspaceAtom).projects.map((record) => record.state.projectData.name),
    ).toEqual(["Remote winner", "Other local edit"]);
    await sync.flush();
    expect(rows.get("two")?.project.state.projectData.name).toBe("Other local edit");
  });

  it("refuses to discard edits made during the cloud fetch and retains data on failed fetches", async () => {
    const { sync, store, client, edit } = await setup();
    edit("Draft");
    const response = deferred<Awaited<ReturnType<ProjectCloudClient["load"]>>>();
    vi.mocked(client.load).mockImplementationOnce(() => response.promise);
    const discarding = sync.discardProjectChanges("one");
    await vi.waitFor(() => expect(client.load).toHaveBeenCalledTimes(2));
    edit("Newer draft");
    response.resolve([]);
    await expect(discarding).rejects.toThrow("changed while discarding");
    expect(store.get(workspaceAtom).projects[0].state.projectData.name).toBe("Newer draft");
    vi.mocked(client.load).mockRejectedValueOnce(new Error("load unavailable"));
    await expect(sync.discardProjectChanges("one")).rejects.toThrow("load unavailable");
    expect(store.get(workspaceAtom).projects[0].state.projectData.name).toBe("Newer draft");
    expect(store.get(projectSyncStatusAtom)).toMatchObject({ state: "error", projectId: "one" });
  });

  it("ignores an old account's discard result", async () => {
    const { sync, client, store } = await setup();
    const response = deferred<Awaited<ReturnType<ProjectCloudClient["load"]>>>();
    vi.mocked(client.load).mockImplementationOnce(() => response.promise);
    const discarding = sync.discardProjectChanges("one");
    await vi.waitFor(() => expect(client.load).toHaveBeenCalledTimes(2));
    sync.stop();
    const next = { version: 1 as const, activeProjectId: "B", projects: [project("B")] };
    store.set(workspaceAtom, next);
    response.resolve([]);
    await expect(discarding).rejects.toThrow("account changed");
    expect(store.get(workspaceAtom)).toBe(next);
  });

  it("uses edits made during an in-flight refresh and serializes its following save", async () => {
    const { rows, store, sync, client, edit } = await setup();
    const response = deferred<Awaited<ReturnType<ProjectCloudClient["load"]>>>();
    vi.mocked(client.load).mockImplementationOnce(() => response.promise);
    const refreshing = sync.refresh();
    await vi.waitFor(() => expect(client.load).toHaveBeenCalledTimes(2));
    edit("Typed while fetching");
    const saving = sync.flush();
    expect(client.save).not.toHaveBeenCalled();
    const remote = {
      project: {
        ...project(),
        state: {
          ...project().state,
          projectData: { ...project().state.projectData, description: "Remote" },
        },
      },
      hash: "remote",
    };
    rows.set("one", remote);
    response.resolve([remote]);
    await refreshing;
    await saving;
    expect(store.get(workspaceAtom).projects[0].state.projectData).toMatchObject({
      name: "Typed while fetching",
      description: "Remote",
    });
  });

  it("waits for a save before fetching and coalesces overlapping refreshes", async () => {
    const { sync, client, rows, edit } = await setup();
    const response = deferred<ProjectSaveResult>();
    vi.mocked(client.save).mockImplementationOnce(() => response.promise);
    edit("Saving");
    const saving = sync.flush();
    await vi.waitFor(() => expect(client.save).toHaveBeenCalledOnce());
    const refreshing = sync.refresh();
    expect(sync.refresh()).toBe(refreshing);
    expect(client.load).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(client.save).mock.calls[0][0];
    rows.set("one", { project: saved, hash: "saved" });
    response.resolve({ saved: true, project: saved, hash: "saved" });
    await saving;
    await refreshing;
    expect(client.load).toHaveBeenCalledTimes(2);
  });

  it("refreshes on visible focus, visibility return and reconnect, and polls only when visible", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { sync, client } = await setup();
    window.dispatchEvent(new Event("focus"));
    await sync.refresh();
    expect(client.load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(PROJECT_REFRESH_INTERVAL_MS);
    expect(client.load).toHaveBeenCalledTimes(3);
    visibility.mockReturnValue("hidden");
    await vi.advanceTimersByTimeAsync(PROJECT_REFRESH_INTERVAL_MS);
    window.dispatchEvent(new Event("focus"));
    expect(client.load).toHaveBeenCalledTimes(3);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await sync.refresh();
    expect(client.load).toHaveBeenCalledTimes(4);
    online.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(PROJECT_REFRESH_INTERVAL_MS);
    expect(client.load).toHaveBeenCalledTimes(4);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await sync.refresh();
    expect(client.load).toHaveBeenCalledTimes(5);
    sync.stop();
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(PROJECT_REFRESH_INTERVAL_MS);
    expect(client.load).toHaveBeenCalledTimes(5);
  });

  it("retains the current store on refresh errors and ignores an old account's response", async () => {
    const { sync, store, client } = await setup();
    const before = store.get(workspaceAtom);
    vi.mocked(client.load).mockRejectedValueOnce(new Error("Refresh unavailable"));
    await expect(sync.refresh()).rejects.toThrow("Refresh unavailable");
    expect(store.get(workspaceAtom)).toBe(before);
    expect(store.get(projectSyncStatusAtom)).toEqual({
      state: "error",
      message: "Refresh unavailable",
    });
    const response = deferred<Awaited<ReturnType<ProjectCloudClient["load"]>>>();
    vi.mocked(client.load).mockImplementationOnce(() => response.promise);
    const refreshing = sync.refresh();
    await vi.waitFor(() => expect(client.load).toHaveBeenCalledTimes(3));
    sync.stop();
    const otherAccount = { version: 1 as const, activeProjectId: "B", projects: [project("B")] };
    store.set(workspaceAtom, otherAccount);
    response.resolve([{ project: project(), hash: "old-owner" }]);
    await expect(refreshing).rejects.toThrow("account changed");
    expect(store.get(workspaceAtom)).toBe(otherAccount);
  });

  it("does not resurrect a project when refresh is queued behind a conditional delete", async () => {
    const { sync, rows, store, client } = await setup();
    const response = deferred<ProjectSaveResult>();
    vi.mocked(client.remove).mockImplementationOnce(() => response.promise);
    const deleting = sync.remove("one");
    await vi.waitFor(() => expect(client.remove).toHaveBeenCalledOnce());
    const refreshing = sync.refresh();
    rows.delete("one");
    response.resolve({ saved: true, project: null, hash: null });
    await deleting;
    await refreshing;
    await sync.flush();
    expect(store.get(workspaceAtom).projects).toHaveLength(0);
    expect(client.save).not.toHaveBeenCalled();
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
    expect(store.get(projectSyncStatusAtom)).toEqual({ state: "error", message: "network failed" });
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

  it("saves unrelated projects even when one project has a merge conflict", async () => {
    const { store, rows, client, sync, edit } = await setup([project(), project("two")]);
    rows.set("one", {
      project: {
        ...project(),
        state: {
          ...project().state,
          projectData: { project_id: "one", name: "Remote winner" },
        },
      },
      hash: "remote-one",
    });
    edit("Local conflict", "one");
    edit("Independent edit", "two");

    await expect(sync.flush()).rejects.toThrow("Conflicting changes");

    expect(store.get(projectSyncStatusAtom)).toMatchObject({
      state: "error",
      projectId: "one",
    });
    expect(rows.get("two")?.project.state.projectData.name).toBe("Independent edit");
    expect(client.save).toHaveBeenCalledTimes(2);
  });

  it("keeps the local version only after fetching the latest hash and cancels a CAS race", async () => {
    const { rows, client, sync, edit } = await setup();
    rows.set("one", {
      project: {
        ...project(),
        state: {
          ...project().state,
          projectData: { project_id: "one", name: "Remote winner" },
        },
      },
      hash: "remote-one",
    });
    edit("Local winner");
    await expect(sync.flush()).rejects.toThrow("Conflicting changes");

    await sync.keepProjectChanges("one");
    expect(vi.mocked(client.save).mock.calls.at(-1)?.[2]).toBe("remote-one");
    expect(rows.get("one")?.project.state.projectData.name).toBe("Local winner");
    expect(sync.hasPendingChanges()).toBe(false);

    const saved = rows.get("one");
    if (!saved) throw new Error("Missing saved cloud project");
    rows.set("one", {
      project: {
        ...saved.project,
        state: {
          ...saved.project.state,
          projectData: { ...saved.project.state.projectData, name: "Other remote edit" },
        },
      },
      hash: "external",
    });
    edit("Second local edit");
    await expect(sync.flush()).rejects.toThrow("Conflicting changes");
    vi.mocked(client.save).mockResolvedValueOnce({
      saved: false,
      project: rows.get("one")?.project ?? null,
      hash: "concurrent-change",
    });
    await expect(sync.keepProjectChanges("one")).rejects.toThrow("changed again");
    expect(rows.get("one")?.project.state.projectData.name).toBe("Other remote edit");
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

  it("deletes an unrelated project while another project has a sync conflict", async () => {
    const { rows, store, sync, edit } = await setup([project(), project("two")]);
    rows.set("one", {
      project: {
        ...project(),
        state: {
          ...project().state,
          projectData: { project_id: "one", name: "Remote winner" },
        },
      },
      hash: "remote-one",
    });
    edit("Local conflict", "one");
    await expect(sync.flush()).rejects.toThrow("Conflicting changes");

    await sync.remove("two");

    expect(rows.has("two")).toBe(false);
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual(["one"]);
    expect(store.get(projectSyncStatusAtom)).toMatchObject({
      state: "error",
      projectId: "one",
    });
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
    expect(rows.has(local.id)).toBe(false);
    await sync.migrateLocalProjects();
    const imported = [...rows.values()].find(
      (row) => row.project.importedFrom?.sourceProjectId === local.id,
    );
    expect(imported).toBeDefined();
    expect(imported?.project.id).not.toBe(local.id);
    expect(imported?.project.importedFrom?.kind).toBe("local-migration");
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
    expect(
      [...rows.values()].some(
        (row) => row.project.importedFrom?.sourceProjectId === originals[0].id,
      ),
    ).toBe(true);
    expect(
      JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects.map(
        (record: ProjectRecord) => record.id,
      ),
    ).toEqual(["second"]);
    await sync.migrateLocalProjects();
    expect(
      [...rows.values()].some(
        (row) => row.project.importedFrom?.sourceProjectId === originals[1].id,
      ),
    ).toBe(true);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects).toEqual([]);
  });

  it("migrates a single-session source only after consent and removes it after acknowledgement", async () => {
    const raw = JSON.stringify({ ...project().state, savedAt: 123 });
    localStorage.setItem(LEGACY_SESSION_KEY, raw);
    const { sync, client, rows } = await setup([]);
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBe(raw);
    vi.mocked(client.save).mockRejectedValueOnce(new Error("failed"));
    await expect(sync.migrateLocalProjects()).rejects.toThrow("failed");
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBe(raw);
    await sync.migrateLocalProjects();
    expect(rows.size).toBe(1);
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
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
