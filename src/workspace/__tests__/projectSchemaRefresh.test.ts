import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { type ProjectCloudClient, startProjectCloudSync } from "../projectCloudSync";
import { projectSyncStatusAtom } from "../syncState";
import { newProjectRecord } from "../types";
import { updateProject } from "../workspace";

describe("newer draft formats during refresh", () => {
  it("preserves dirty drafts without treating unreadable projects as deletions or saving them", async () => {
    const first = newProjectRecord();
    const second = newProjectRecord();
    let upgraded = false;
    const client: ProjectCloudClient = {
      load: vi.fn(async () => [
        upgraded ? { projectId: first.id, schemaVersion: 2 } : { project: first, hash: "first" },
        { project: second, hash: "second" },
      ]),
      save: vi.fn(async (project) => ({ saved: true, project, hash: "saved" })),
      remove: vi.fn(),
    };
    const store = createStore();
    const sync = startProjectCloudSync(store, client);
    try {
      await sync.load();
      for (const project of [first, second]) {
        store.set(workspaceAtom, (workspace) =>
          updateProject(workspace, project.id, {
            ...project.state,
            projectData: { name: "local edits" },
          }),
        );
      }
      const local = store.get(workspaceAtom).projects[0];
      upgraded = true;
      await sync.refresh();
      expect(store.get(workspaceAtom).projects[0]).toBe(local);
      await expect(sync.flush()).rejects.toThrow("Reload");
      expect(client.save).toHaveBeenCalledTimes(1);
      expect(client.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: second.id }),
        expect.any(String),
        "second",
      );
      await expect(sync.discardProjectChanges(first.id)).rejects.toThrow("Reload");
      expect(store.get(workspaceAtom).projects[0]).toBe(local);
      expect(client.remove).not.toHaveBeenCalled();
      expect(store.get(projectSyncStatusAtom)).toMatchObject({
        state: "error",
        message: expect.stringContaining("Reload"),
      });
    } finally {
      sync.stop();
    }
  });

  it("keeps a clean newer project in memory and shows the reload message after repeated refreshes", async () => {
    const project = newProjectRecord();
    let upgraded = false;
    const client: ProjectCloudClient = {
      load: async () => [
        upgraded ? { projectId: project.id, schemaVersion: 2 } : { project, hash: "original" },
      ],
      save: vi.fn(),
      remove: vi.fn(),
    };
    const store = createStore();
    const sync = startProjectCloudSync(store, client);
    try {
      await sync.load();
      const original = store.get(workspaceAtom).projects[0];
      upgraded = true;
      await sync.refresh();
      await sync.refresh();
      expect(store.get(workspaceAtom).projects[0]).toBe(original);
      await sync.flush();
      expect(store.get(projectSyncStatusAtom).state).toBe("error");
      expect(client.save).not.toHaveBeenCalled();
      expect(client.remove).not.toHaveBeenCalled();
    } finally {
      sync.stop();
    }
  });
});
