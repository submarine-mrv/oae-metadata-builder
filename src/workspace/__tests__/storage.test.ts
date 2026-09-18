import { beforeEach, describe, expect, it } from "vitest";
import { LEGACY_SESSION_KEY, localStorageWorkspaceStore, WORKSPACE_KEY } from "../storage";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";

function workspaceFixture(): Workspace {
  const project = newProjectRecord({ ...emptyProjectState(), hasProject: true }, 100);
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

describe("localStorageWorkspaceStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(localStorageWorkspaceStore.load()).toBeNull();
  });

  it("round-trips a workspace", () => {
    const ws = workspaceFixture();
    localStorageWorkspaceStore.save(ws);
    expect(localStorageWorkspaceStore.load()).toEqual(ws);
  });

  it("round-trips an empty workspace", () => {
    const ws: Workspace = { version: 1, activeProjectId: null, projects: [] };
    localStorageWorkspaceStore.save(ws);
    expect(localStorageWorkspaceStore.load()).toEqual(ws);
  });

  it("rejects a null active id when projects exist", () => {
    const ws = workspaceFixture();
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ ...ws, activeProjectId: null }));
    expect(localStorageWorkspaceStore.load()).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  });

  it("drops malformed data instead of throwing", () => {
    localStorage.setItem(WORKSPACE_KEY, '{"version":1,"projects":"nope"}');
    expect(localStorageWorkspaceStore.load()).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  });

  it("migrates a legacy single session into the first project and removes the old key", () => {
    localStorage.setItem(
      LEGACY_SESSION_KEY,
      JSON.stringify({
        savedAt: 1234,
        hasProject: true,
        projectData: { project_id: "P1", name: "Old project" },
        experiments: [],
        datasets: [],
        nextExperimentId: 3,
        nextDatasetId: 2,
      }),
    );

    const ws = localStorageWorkspaceStore.load();
    expect(ws).not.toBeNull();
    expect(ws?.projects).toHaveLength(1);
    expect(ws?.projects[0].state.projectData.name).toBe("Old project");
    expect(ws?.projects[0].createdAt).toBe(1234);
    expect(ws?.activeProjectId).toBe(ws?.projects[0].id);
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
  });

  it("ignores a malformed legacy session", () => {
    localStorage.setItem(LEGACY_SESSION_KEY, '{"hasProject":true}');
    expect(localStorageWorkspaceStore.load()).toBeNull();
  });
});
