import {
  emptyProjectState,
  newProjectRecord,
  type ProjectRecord,
  type ProjectState,
  type Workspace,
} from "./types";

export function emptyWorkspace(now: number = Date.now()): Workspace {
  const project = newProjectRecord(undefined, now);
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

export function addProject(workspace: Workspace, record: ProjectRecord): Workspace {
  return { ...workspace, activeProjectId: record.id, projects: [...workspace.projects, record] };
}

/** A new project ready for the project form, made active. */
export function createProject(
  workspace: Workspace,
  now: number = Date.now(),
): { workspace: Workspace; id: string } {
  const record = newProjectRecord({ ...emptyProjectState(), hasProject: true }, now);
  return { workspace: addProject(workspace, record), id: record.id };
}

export function switchProject(workspace: Workspace, id: string): Workspace {
  if (!workspace.projects.some((p) => p.id === id)) return workspace;
  return { ...workspace, activeProjectId: id };
}

export function deleteProject(
  workspace: Workspace,
  id: string,
  now: number = Date.now(),
): Workspace {
  const projects = workspace.projects.filter((p) => p.id !== id);
  if (projects.length === workspace.projects.length) return workspace;

  if (projects.length === 0) return emptyWorkspace(now);

  if (workspace.activeProjectId !== id) return { ...workspace, projects };

  const mostRecent = projects.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  return { ...workspace, activeProjectId: mostRecent.id, projects };
}

export function updateProject(
  workspace: Workspace,
  id: string,
  state: ProjectState,
  now: number = Date.now(),
): Workspace {
  const index = workspace.projects.findIndex((p) => p.id === id);
  if (index === -1 || workspace.projects[index].state === state) return workspace;

  const projects = [...workspace.projects];
  projects[index] = { ...projects[index], state, updatedAt: now };
  return { ...workspace, projects };
}

export function activeProject(workspace: Workspace): ProjectRecord {
  return (
    workspace.projects.find((p) => p.id === workspace.activeProjectId) ?? workspace.projects[0]
  );
}
