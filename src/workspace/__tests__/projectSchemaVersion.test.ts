import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import {
  type ProjectCloudClient,
  parseCloudProject,
  readRemoteProject,
  startProjectCloudSync,
  UnsupportedProjectVersionError,
} from "../projectCloudSync";
import { projectSyncStatusAtom } from "../syncState";
import { newProjectRecord } from "../types";
import { updateProject } from "../workspace";

describe("draft schema versions", () => {
  it("migrates unversioned drafts and stamps new records", () => {
    const record = newProjectRecord();
    const { schemaVersion: _, ...unversioned } = record;
    expect(record.schemaVersion).toBe(1);
    expect(parseCloudProject(unversioned)).toEqual(record);
  });

  it("checks future versions before interpreting their unknown state", () => {
    const future = { id: "future", schemaVersion: 2, state: { unknown: true } };
    expect(() => parseCloudProject(future)).toThrow(UnsupportedProjectVersionError);
    expect(readRemoteProject(future, "future", "hash")).toEqual({
      projectId: "future",
      schemaVersion: 2,
    });
    expect(() => readRemoteProject(future, "wrong", "hash")).toThrow("invalid");
  });

  it.each([
    null,
    "1",
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid explicit version %s", (schemaVersion) => {
    expect(() => parseCloudProject({ ...newProjectRecord(), schemaVersion })).toThrow(
      "invalid schema version",
    );
  });

  it("does not load or overwrite a future project while other projects still save", async () => {
    const project = newProjectRecord();
    const save = vi.fn(async () => ({ saved: true, project, hash: "saved" }));
    const client: ProjectCloudClient = {
      load: async () => [
        { projectId: "future", schemaVersion: 2 },
        { project, hash: "initial" },
      ],
      save,
      remove: vi.fn(),
    };
    const store = createStore();
    const sync = startProjectCloudSync(store, client);
    try {
      await sync.load();
      expect(store.get(workspaceAtom).projects).toEqual([project]);
      expect(store.get(projectSyncStatusAtom)).toMatchObject({
        state: "error",
        message: expect.stringContaining("Reload"),
      });
      store.set(workspaceAtom, (workspace) =>
        updateProject(workspace, project.id, {
          ...project.state,
          projectData: { name: "edited" },
        }),
      );
      await expect(sync.flush()).rejects.toThrow("Reload");
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ id: project.id }),
        expect.any(String),
        "initial",
      );
      expect(client.remove).not.toHaveBeenCalled();
    } finally {
      sync.stop();
    }
  });

  it("keeps a rejected draft in memory and saves other projects after a server downgrade error", async () => {
    const first = newProjectRecord();
    const second = newProjectRecord();
    const client: ProjectCloudClient = {
      load: async () => [
        { project: first, hash: "first" },
        { project: second, hash: "second" },
      ],
      save: vi.fn(async (project) => {
        if (project.id === first.id) throw new UnsupportedProjectVersionError(first.id);
        return { saved: true, project, hash: "saved" };
      }),
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
            projectData: { name: "unsaved" },
          }),
        );
      }
      await expect(sync.flush()).rejects.toThrow("Reload");
      expect(client.save).toHaveBeenCalledTimes(2);
      await expect(sync.flush()).rejects.toThrow("Reload");
      expect(client.save).toHaveBeenCalledTimes(2);
      expect(store.get(workspaceAtom).projects[0].state.projectData.name).toBe("unsaved");
      expect(sync.hasPendingChanges()).toBe(true);
    } finally {
      sync.stop();
    }
  });
});
