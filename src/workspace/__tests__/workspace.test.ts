import { describe, expect, it } from "vitest";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";
import {
  addProject,
  createProject,
  deleteProject,
  emptyWorkspace,
  switchProject,
  updateProject,
} from "../workspace";

function twoProjects(): Workspace {
  const a = newProjectRecord(undefined, 100);
  const b = newProjectRecord(undefined, 200);
  return { version: 1, activeProjectId: a.id, projects: [a, b] };
}

describe("emptyWorkspace", () => {
  it("starts with one unnamed, active project", () => {
    const ws = emptyWorkspace();
    expect(ws.projects).toHaveLength(1);
    expect(ws.activeProjectId).toBe(ws.projects[0].id);
    expect(ws.projects[0].state.hasProject).toBe(false);
  });
});

describe("createProject", () => {
  it("adds a project with hasProject set and makes it active", () => {
    const ws = twoProjects();
    const { workspace, id } = createProject(ws, 300);
    expect(workspace.projects).toHaveLength(3);
    expect(workspace.activeProjectId).toBe(id);
    expect(workspace.projects.find((p) => p.id === id)?.state.hasProject).toBe(true);
  });
});

describe("switchProject", () => {
  it("changes the active id when it exists and ignores unknown ids", () => {
    const ws = twoProjects();
    const target = ws.projects[1].id;
    expect(switchProject(ws, target).activeProjectId).toBe(target);
    expect(switchProject(ws, "nope").activeProjectId).toBe(ws.activeProjectId);
  });
});

describe("deleteProject", () => {
  it("removes the project and keeps the active one when it was not deleted", () => {
    const ws = twoProjects();
    const result = deleteProject(ws, ws.projects[1].id, 400);
    expect(result.projects).toHaveLength(1);
    expect(result.activeProjectId).toBe(ws.projects[0].id);
  });

  it("activates the most recently edited remaining project when the active one is deleted", () => {
    const ws = twoProjects();
    const result = deleteProject(ws, ws.projects[0].id, 400);
    expect(result.activeProjectId).toBe(ws.projects[1].id);
  });

  it("creates a fresh unnamed project when the last one is deleted", () => {
    const ws = emptyWorkspace();
    const result = deleteProject(ws, ws.projects[0].id, 400);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].id).not.toBe(ws.projects[0].id);
    expect(result.activeProjectId).toBe(result.projects[0].id);
  });
});

describe("updateProject", () => {
  it("replaces the state and bumps updatedAt only for that project", () => {
    const ws = twoProjects();
    const next = { ...emptyProjectState(), hasProject: true };
    const result = updateProject(ws, ws.projects[0].id, next, 500);
    expect(result.projects[0].state).toBe(next);
    expect(result.projects[0].updatedAt).toBe(500);
    expect(result.projects[1].updatedAt).toBe(200);
  });

  it("returns the same workspace when nothing changed", () => {
    const ws = twoProjects();
    expect(updateProject(ws, ws.projects[0].id, ws.projects[0].state, 500)).toBe(ws);
  });
});

describe("addProject", () => {
  it("adds a record and makes it active", () => {
    const ws = twoProjects();
    const record = newProjectRecord(undefined, 600);
    const result = addProject(ws, record);
    expect(result.projects).toContain(record);
    expect(result.activeProjectId).toBe(record.id);
  });
});
