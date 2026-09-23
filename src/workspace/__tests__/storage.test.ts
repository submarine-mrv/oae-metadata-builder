import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_KEY_PREFIX,
  LEGACY_SESSION_KEY,
  localStorageWorkspaceStore,
  WORKSPACE_KEY,
} from "../storage";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";

function workspaceFixture(): Workspace {
  const project = newProjectRecord(emptyProjectState(), 100);
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

function twoProjectFixture(): Workspace {
  const older = newProjectRecord(emptyProjectState(), 100);
  const newer = newProjectRecord(emptyProjectState(), 200);
  return { version: 1, activeProjectId: older.id, projects: [older, newer] };
}

const LEGACY_SESSION = JSON.stringify({
  savedAt: 1234,
  projectData: { project_id: "P1", research_project: "Old project" },
  experiments: [],
  datasets: [],
  nextExperimentId: 3,
  nextDatasetId: 2,
});

function backups(): string[] {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(BACKUP_KEY_PREFIX))
    .map((key) => localStorage.getItem(key) as string);
}

describe("localStorageWorkspaceStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("loads a record saved with hasProject", () => {
    const ws = workspaceFixture();
    const saved = {
      ...ws,
      projects: ws.projects.map((p) => ({ ...p, state: { ...p.state, hasProject: true } })),
    };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(saved));
    expect(localStorageWorkspaceStore.load()?.projects[0].id).toBe(ws.projects[0].id);
  });

  it("repairs a null active id to the most recently edited project", () => {
    const ws = twoProjectFixture();
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ ...ws, activeProjectId: null }));
    const loaded = localStorageWorkspaceStore.load();
    expect(loaded?.projects).toHaveLength(2);
    expect(loaded?.activeProjectId).toBe(ws.projects[1].id);
  });

  it("repairs a dangling active id and saves the repair", () => {
    const ws = twoProjectFixture();
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ ...ws, activeProjectId: "gone" }));
    const loaded = localStorageWorkspaceStore.load();
    expect(loaded?.activeProjectId).toBe(ws.projects[1].id);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) as string).activeProjectId).toBe(
      ws.projects[1].id,
    );
    expect(backups()).toHaveLength(0);
  });

  it("drops an unreadable record, keeps the rest, and backs up the original", () => {
    const ws = twoProjectFixture();
    const raw = JSON.stringify({ ...ws, projects: [...ws.projects, { id: "bad" }] });
    localStorage.setItem(WORKSPACE_KEY, raw);

    const loaded = localStorageWorkspaceStore.load();
    expect(loaded?.projects.map((p) => p.id)).toEqual(ws.projects.map((p) => p.id));
    expect(loaded?.activeProjectId).toBe(ws.activeProjectId);
    expect(backups()).toEqual([raw]);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) as string).projects).toHaveLength(2);
  });

  it("keeps an unreadable record in saves until its backup succeeds", () => {
    const ws = twoProjectFixture();
    const bad = { id: "bad" };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ ...ws, projects: [...ws.projects, bad] }));
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    const realSetItem = proto.setItem;
    const setItem = vi.spyOn(proto, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.startsWith(BACKUP_KEY_PREFIX)) throw new Error("QuotaExceededError");
      realSetItem.call(this, key, value);
    });

    const loaded = localStorageWorkspaceStore.load() as Workspace;
    expect(backups()).toHaveLength(0);
    localStorageWorkspaceStore.save({ ...loaded, projects: loaded.projects.slice(0, 1) });
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) as string).projects).toEqual([
      JSON.parse(JSON.stringify(ws.projects[0])),
      bad,
    ]);

    setItem.mockRestore();
    const reloaded = localStorageWorkspaceStore.load() as Workspace;
    expect(backups()).toHaveLength(1);
    expect(JSON.parse(backups()[0]).projects).toContainEqual(bad);
    localStorageWorkspaceStore.save(reloaded);
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY) as string);
    expect(saved.projects.map((p: { id: string }) => p.id)).toEqual([ws.projects[0].id]);
  });

  it("drops a record with a null experiment instead of crashing", () => {
    const ws = twoProjectFixture();
    const broken = { ...ws.projects[1], state: { ...ws.projects[1].state, experiments: [null] } };
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({ ...ws, projects: [ws.projects[0], broken] }),
    );
    const loaded = localStorageWorkspaceStore.load();
    expect(loaded?.projects.map((p) => p.id)).toEqual([ws.projects[0].id]);
    expect(backups()).toHaveLength(1);
  });

  it("backs up malformed JSON and returns null", () => {
    localStorage.setItem(WORKSPACE_KEY, "{not json");
    expect(localStorageWorkspaceStore.load()).toBeNull();
    expect(backups()).toEqual(["{not json"]);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    // A second load finds nothing to back up.
    localStorageWorkspaceStore.load();
    expect(backups()).toHaveLength(1);
  });

  it("backs up a workspace with an unknown version", () => {
    const raw = JSON.stringify({ ...workspaceFixture(), version: 2 });
    localStorage.setItem(WORKSPACE_KEY, raw);
    expect(localStorageWorkspaceStore.load()).toBeNull();
    expect(backups()).toEqual([raw]);
  });

  it("backs up an envelope without a projects array", () => {
    localStorage.setItem(WORKSPACE_KEY, '{"version":1,"projects":"nope"}');
    expect(localStorageWorkspaceStore.load()).toBeNull();
    expect(backups()).toEqual(['{"version":1,"projects":"nope"}']);
  });

  it("keeps unreadable data in place when the backup can't be written", () => {
    localStorage.setItem(WORKSPACE_KEY, "{not json");
    vi.spyOn(Object.getPrototypeOf(localStorage), "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(localStorageWorkspaceStore.load()).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe("{not json");
  });

  it("migrates a legacy single session into the first project and removes the old key", () => {
    localStorage.setItem(
      LEGACY_SESSION_KEY,
      JSON.stringify({
        savedAt: 1234,
        hasProject: true,
        projectData: { project_id: "P1", research_project: "Old project" },
        experiments: [],
        datasets: [],
        nextExperimentId: 3,
        nextDatasetId: 2,
      }),
    );

    const ws = localStorageWorkspaceStore.load();
    expect(ws).not.toBeNull();
    expect(ws?.projects).toHaveLength(1);
    expect(ws?.projects[0].state.projectData.research_project).toBe("Old project");
    expect(ws?.projects[0].state).not.toHaveProperty("hasProject");
    expect(ws?.projects[0].createdAt).toBe(1234);
    expect(ws?.activeProjectId).toBe(ws?.projects[0].id);
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
  });

  it("keeps the legacy session when the migrated workspace can't be saved", () => {
    localStorage.setItem(LEGACY_SESSION_KEY, LEGACY_SESSION);
    vi.spyOn(Object.getPrototypeOf(localStorage), "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(localStorageWorkspaceStore.load()?.projects).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBe(LEGACY_SESSION);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  });

  it("ignores and keeps a leftover legacy session when a workspace exists", () => {
    const ws = workspaceFixture();
    localStorageWorkspaceStore.save(ws);
    localStorage.setItem(LEGACY_SESSION_KEY, LEGACY_SESSION);
    expect(localStorageWorkspaceStore.load()).toEqual(ws);
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBe(LEGACY_SESSION);
  });

  it("ignores a malformed legacy session", () => {
    localStorage.setItem(LEGACY_SESSION_KEY, '{"hasProject":true}');
    expect(localStorageWorkspaceStore.load()).toBeNull();
  });
});
