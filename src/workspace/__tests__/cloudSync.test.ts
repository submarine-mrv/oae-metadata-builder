import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import type { RemoteWorkspace, WorkspaceCloudClient } from "../cloudSync";
import {
  activateWorkspaceAccount,
  deactivateWorkspaceAccount,
  startWorkspaceSync,
} from "../cloudSync";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";

function makeWorkspace(projectId: string, name: string): Workspace {
  const project = newProjectRecord({
    ...emptyProjectState(),
    projectData: { project_id: projectId, research_project: name },
  });
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

function waitFor(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - started > 2000) {
        reject(new Error("Timed out waiting for workspace sync."));
      } else {
        setTimeout(check, 0);
      }
    };
    check();
  });
}

function online(value: boolean): void {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

describe("workspace cloud sync", () => {
  beforeEach(() => {
    localStorage.clear();
    online(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a local workspace when the authenticated account has no cloud snapshot", async () => {
    const store = createStore();
    const local = makeWorkspace("P1", "Local");
    store.set(workspaceAtom, local);
    const remote: { value: RemoteWorkspace | null } = { value: null };
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => remote.value),
      save: vi.fn(async (state, stateHash, expectedHash) => {
        expect(expectedHash).toBeNull();
        remote.value = { state, stateHash };
        return { saved: true, state, stateHash };
      }),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));

    await waitFor(() => statuses.includes("synced"));
    expect(client.load).toHaveBeenCalledOnce();
    expect(client.save).toHaveBeenCalledOnce();
    expect(
      remote.value && (remote.value.state as Workspace).projects[0].state.projectData.project_id,
    ).toBe("P1");
    controller.stop();
  });

  it("merges the cloud workspace into local state and uploads the merged snapshot", async () => {
    const store = createStore();
    const local = makeWorkspace("P1", "Local");
    store.set(workspaceAtom, local);
    const cloud = makeWorkspace("P2", "Cloud");
    const remote: RemoteWorkspace = { state: cloud, stateHash: "cloud-hash" };
    const saved: Workspace[] = [];
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => remote),
      save: vi.fn(async (state) => {
        saved.push(state);
        return { saved: true, state, stateHash: "merged-hash" };
      }),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));

    await waitFor(() => statuses.includes("synced"));
    expect(
      store.get(workspaceAtom).projects.map((project) => project.state.projectData.project_id),
    ).toEqual(["P1", "P2"]);
    expect(saved).toHaveLength(1);
    controller.stop();
  });

  it("migrates a legacy single-project cloud snapshot into the workspace format", async () => {
    const store = createStore();
    const legacyState = {
      ...emptyProjectState(),
      projectData: { project_id: "LEGACY", research_project: "Saved before workspaces" },
      savedAt: 20,
    };
    const saved: { value: Workspace | null } = { value: null };
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => ({ state: legacyState, stateHash: "legacy-hash" })),
      save: vi.fn(async (state, stateHash) => {
        saved.value = state;
        return { saved: true, state, stateHash };
      }),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));

    await waitFor(() => statuses.includes("synced"));
    expect(store.get(workspaceAtom).projects[0].state.projectData.project_id).toBe("LEGACY");
    expect(saved.value?.version).toBe(1);
    controller.stop();
  });

  it("coalesces offline edits and uploads only the latest full workspace after reconnect", async () => {
    online(false);
    const store = createStore();
    store.set(workspaceAtom, makeWorkspace("P1", "Initial"));
    const saved: Workspace[] = [];
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => null),
      save: vi.fn(async (state, stateHash) => {
        saved.push(state);
        return { saved: true, state, stateHash };
      }),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));
    await waitFor(() => statuses.includes("pending"));
    expect(client.load).not.toHaveBeenCalled();

    store.set(workspaceAtom, makeWorkspace("P1", "Intermediate"));
    store.set(workspaceAtom, makeWorkspace("P1", "Latest"));
    online(true);
    window.dispatchEvent(new Event("online"));

    await waitFor(() => statuses.includes("synced"));
    expect(client.load).toHaveBeenCalledOnce();
    expect(saved).toHaveLength(1);
    expect(saved[0].projects[0].state.projectData.research_project).toBe("Latest");
    controller.stop();
  });

  it("merges a newer server revision before retrying a stale save", async () => {
    const store = createStore();
    store.set(workspaceAtom, makeWorkspace("P1", "Initial"));
    let serverState = makeWorkspace("P1", "Initial");
    let serverHash = "cloud-v1";
    let saveCount = 0;
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => ({ state: serverState, stateHash: serverHash })),
      save: vi.fn(async (state, stateHash, expectedHash) => {
        saveCount += 1;
        if (saveCount === 1) {
          serverState = makeWorkspace("P1", "Newer cloud edit");
          serverHash = "cloud-v2";
          return { saved: false, state: serverState, stateHash: serverHash };
        }
        expect(expectedHash).toBe("cloud-v2");
        serverState = state;
        serverHash = stateHash;
        return { saved: true, state, stateHash };
      }),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));

    await waitFor(() => statuses.includes("synced"));
    store.set(workspaceAtom, makeWorkspace("P1", "Local edit"));
    await waitFor(() => saveCount === 2);
    await waitFor(() => statuses.at(-1) === "synced");

    expect(saveCount).toBe(2);
    expect(store.get(workspaceAtom).projects[0].state.projectData.research_project).toBe(
      "Newer cloud edit",
    );
    controller.stop();
  });

  it("keeps account workspaces separated when switching accounts and signing out", () => {
    const store = createStore();
    const guest = makeWorkspace("GUEST", "Guest draft");
    store.set(workspaceAtom, guest);

    activateWorkspaceAccount(store, "user-a");
    store.set(workspaceAtom, makeWorkspace("USER-A", "A's private draft"));
    deactivateWorkspaceAccount(store, "user-a");
    expect(store.get(workspaceAtom).projects[0].state.projectData.project_id).toBe("GUEST");

    activateWorkspaceAccount(store, "user-b");
    expect(store.get(workspaceAtom).projects[0].state.projectData.project_id).toBe("GUEST");
    store.set(workspaceAtom, makeWorkspace("USER-B", "B's private draft"));
    deactivateWorkspaceAccount(store, "user-b");
    activateWorkspaceAccount(store, "user-a");

    expect(store.get(workspaceAtom).projects[0].state.projectData.project_id).toBe("USER-A");
    expect(store.get(workspaceAtom).projects[0].state.projectData.research_project).toBe(
      "A's private draft",
    );
  });

  it("pauses after a failed save and retries only the latest snapshot on request", async () => {
    const store = createStore();
    store.set(workspaceAtom, makeWorkspace("P1", "Initial"));
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => null),
      save: vi
        .fn<WorkspaceCloudClient["save"]>()
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockImplementation(async (state, stateHash) => ({ saved: true, state, stateHash })),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));

    try {
      await waitFor(() => statuses.includes("error"));
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(client.save).toHaveBeenCalledOnce();
      expect(statuses.at(-1)).toBe("error");

      online(false);
      const latest = makeWorkspace("P1", "Latest offline edit");
      store.set(workspaceAtom, latest);
      online(true);
      controller.retry();

      await waitFor(() => statuses.at(-1) === "synced");
      expect(client.save).toHaveBeenCalledTimes(2);
      expect(vi.mocked(client.save).mock.calls[1][0]).toEqual(latest);
    } finally {
      controller.stop();
    }
  });

  it("stops after the conflict retry limit without starting another save loop", async () => {
    const store = createStore();
    const local = makeWorkspace("P1", "Local draft");
    store.set(workspaceAtom, local);
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => null),
      save: vi.fn(async () => ({ saved: false, state: null, stateHash: "newer-hash" })),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));

    try {
      await waitFor(() => statuses.includes("error"));
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(client.save).toHaveBeenCalledTimes(4);
      expect(statuses.at(-1)).toBe("error");
      expect(store.get(workspaceAtom)).toEqual(local);
    } finally {
      controller.stop();
    }
  });

  it("keeps edits queued during an in-flight save without losing the next upload", async () => {
    const store = createStore();
    store.set(workspaceAtom, makeWorkspace("P1", "Initial"));
    let completeSave:
      | ((value: Awaited<ReturnType<WorkspaceCloudClient["save"]>>) => void)
      | undefined;
    const client: WorkspaceCloudClient = {
      load: vi.fn(async () => null),
      save: vi
        .fn<WorkspaceCloudClient["save"]>()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              completeSave = resolve;
            }),
        )
        .mockImplementation(async (state, stateHash) => ({ saved: true, state, stateHash })),
    };
    const statuses: string[] = [];
    const controller = startWorkspaceSync(store, client, (status) => statuses.push(status.state));

    try {
      await waitFor(() => completeSave !== undefined);
      const latest = makeWorkspace("P1", "Edited during save");
      store.set(workspaceAtom, latest);
      completeSave?.({ saved: true, state: null, stateHash: "first-hash" });

      await waitFor(() => statuses.at(-1) === "synced");
      expect(client.save).toHaveBeenCalledTimes(2);
      expect(vi.mocked(client.save).mock.calls[1][0]).toEqual(latest);
      expect(vi.mocked(client.save).mock.calls[1][2]).toBe("first-hash");
    } finally {
      controller.stop();
    }
  });
});
