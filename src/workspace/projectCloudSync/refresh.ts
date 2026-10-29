import { mergeProjectRecord, reconcileProjectRecord } from "../merge";
import { ProjectConflictError } from "../syncState";
import type { ProjectRecord, Workspace } from "../types";
import { errorMessage, parseCloudProject, UnsupportedProjectVersionError } from "./helper";
import type { CloudProject, RemoteProject } from "./types";

export function parseRemoteProjects(rows: CloudProject[]) {
  const remote = new Map<string, RemoteProject>();
  const unsupported = new Map<string, UnsupportedProjectVersionError>();
  const ids = new Set<string>();
  for (const row of rows) {
    const id = "projectId" in row ? row.projectId : row.project.id;
    if (ids.has(id)) throw new Error("The cloud returned duplicate project records.");
    ids.add(id);
    if ("projectId" in row) {
      unsupported.set(id, new UnsupportedProjectVersionError(id, row.schemaVersion));
      continue;
    }
    const project = parseCloudProject(row.project);
    if (typeof row.hash !== "string" || !row.hash.trim()) {
      throw new Error("The cloud returned an invalid project hash.");
    }
    if (remote.has(project.id)) throw new Error("The cloud returned duplicate project records.");
    remote.set(project.id, { project, hash: row.hash });
  }
  return { remote, unsupported };
}

/** Plan the whole refresh before committing it, so a conflict cannot advance any baselines. */
export function reconcileRemoteProjects(
  workspace: Workspace,
  acknowledged: Map<string, RemoteProject>,
  remote: Map<string, RemoteProject>,
  unsupported: ReadonlySet<string> = new Set(),
) {
  const projects: ProjectRecord[] = [];
  const nextAcknowledged = new Map<string, RemoteProject>();
  // An unreadable newer draft is not a deletion. Retain its local edits and baseline.
  for (const [id, row] of acknowledged) {
    if (unsupported.has(id)) nextAcknowledged.set(id, row);
  }
  for (const local of workspace.projects) {
    if (unsupported.has(local.id)) {
      projects.push(local);
      continue;
    }
    const base = acknowledged.get(local.id);
    const incoming = remote.get(local.id);
    if (!incoming) {
      if (!base) projects.push(local);
      else if (local !== base.project) {
        throw new ProjectConflictError(
          local.id,
          "This project was deleted on another device. Export your edits to keep them.",
        );
      }
      continue;
    }
    if (base?.hash === incoming.hash) {
      projects.push(local);
      nextAcknowledged.set(local.id, base);
    } else {
      try {
        projects.push(
          base
            ? local === base.project
              ? incoming.project
              : reconcileProjectRecord(local, incoming.project, base.project)
            : mergeProjectRecord(local, incoming.project),
        );
      } catch (error) {
        throw new ProjectConflictError(local.id, errorMessage(error));
      }
      nextAcknowledged.set(local.id, incoming);
    }
  }
  for (const [id, incoming] of remote) {
    if (workspace.projects.some((project) => project.id === id)) continue;
    const base = acknowledged.get(id);
    if (base) {
      // An absent local row is a pending local delete, not a remote addition.
      if (base.hash !== incoming.hash) {
        throw new ProjectConflictError(
          id,
          "This project changed on another device. Reload before deleting it.",
        );
      }
      nextAcknowledged.set(id, base);
    } else {
      projects.push(incoming.project);
      nextAcknowledged.set(id, incoming);
    }
  }
  const activeProjectId = projects.some((project) => project.id === workspace.activeProjectId)
    ? workspace.activeProjectId
    : null;
  const unchanged =
    activeProjectId === workspace.activeProjectId &&
    projects.length === workspace.projects.length &&
    projects.every((project, index) => project === workspace.projects[index]);
  return {
    workspace: unchanged ? workspace : { ...workspace, projects, activeProjectId },
    acknowledged: nextAcknowledged,
  };
}
