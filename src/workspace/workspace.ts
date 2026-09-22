import type { ProjectRecord, ProjectState, Workspace } from "./types";

export function emptyWorkspace(): Workspace {
  return { version: 1, activeProjectId: null, projects: [] };
}

export function addProject(workspace: Workspace, record: ProjectRecord): Workspace {
  return { ...workspace, activeProjectId: record.id, projects: [...workspace.projects, record] };
}

export function switchProject(workspace: Workspace, id: string): Workspace {
  if (!workspace.projects.some((p) => p.id === id)) return workspace;
  return { ...workspace, activeProjectId: id };
}

export function deleteProject(workspace: Workspace, id: string): Workspace {
  const projects = workspace.projects.filter((p) => p.id !== id);
  if (projects.length === workspace.projects.length) return workspace;

  if (projects.length === 0) return emptyWorkspace();

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

export function activeProject(workspace: Workspace): ProjectRecord | null {
  return (
    workspace.projects.find((p) => p.id === workspace.activeProjectId) ??
    workspace.projects[0] ??
    null
  );
}
