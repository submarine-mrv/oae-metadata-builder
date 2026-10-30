import { workspaceAtom } from "@/state/atoms";
import { SAVE_DEBOUNCE_MS } from "@/state/persistence";
import type { AppStore } from "@/state/store";
import { mergeProjectRecord, reconcileProjectRecord } from "../merge";
import { readLocalProjectSources } from "../storage";
import {
  ProjectConflictError,
  type ProjectSyncStatus,
  projectSyncErrorStatus,
  projectSyncStatusAtom,
} from "../syncState";
import { forkProjectRecord } from "../types";
import { deleteProject, mostRecent } from "../workspace";
import {
  checkProjectVersion,
  errorMessage,
  hashProject,
  parseCloudProject,
  UnsupportedProjectVersionError,
} from "./helper";
import { parseRemoteProjects, reconcileRemoteProjects } from "./refresh";
import type { ProjectCloudClient, ProjectSaveResult, RemoteProject } from "./types";

export const PROJECT_REFRESH_INTERVAL_MS = 15_000;

export function startProjectCloudSync(store: AppStore, client: ProjectCloudClient) {
  const acknowledged = new Map<string, RemoteProject>();
  const unsupported = new Map<string, UnsupportedProjectVersionError>();
  const versionError = () => unsupported.values().next().value;
  const settledStatus = () => {
    const error = versionError();
    status(error ? { state: "error", message: error.message } : { state: "synced" });
  };
  let stopped = false;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let refreshing: Promise<void> | null = null;
  let operations = Promise.resolve();
  let applyingRemote = false;

  const status = (value: ProjectSyncStatus) => {
    if (!stopped) store.set(projectSyncStatusAtom, value);
  };
  const cancelTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const currentProject = (id: string) =>
    store.get(workspaceAtom).projects.find((project) => project.id === id);
  const pendingVersionError = () => {
    for (const [id, error] of unsupported) {
      if (currentProject(id) !== acknowledged.get(id)?.project) return error;
    }
  };
  const dirty = () =>
    ready &&
    (store
      .get(workspaceAtom)
      .projects.some((project) => acknowledged.get(project.id)?.project !== project) ||
      [...acknowledged.keys()].some((id) => !currentProject(id)));

  const assertActive = () => {
    if (stopped) throw new Error("The account changed before project sync completed.");
  };

  // Reads, writes, and deletes share one queue; a failed operation does not poison later retries.
  const serialize = (operation: () => Promise<void>) => {
    const next = operations.then(async () => {
      assertActive();
      await operation();
    });
    operations = next.catch(() => {});
    return next;
  };

  const writeProject = async (id: string) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      assertActive();
      const project = currentProject(id);
      const previous = acknowledged.get(id);
      if (unsupported.has(id) || !project || previous?.project === project) return;
      checkProjectVersion(project);
      const hash = await hashProject(project);
      assertActive();
      let result: ProjectSaveResult;
      try {
        result = await client.save(project, hash, previous?.hash ?? null);
      } catch (error) {
        if (!(error instanceof UnsupportedProjectVersionError)) throw error;
        unsupported.set(id, error);
        return;
      }
      assertActive();
      if (result.saved) {
        if (!result.hash) throw new Error("The cloud did not acknowledge the saved project.");
        acknowledged.set(id, { project, hash: result.hash });
        return;
      }
      if (!result.project || !result.hash) {
        throw new ProjectConflictError(
          id,
          "This project was deleted on another device. Export your edits to keep them.",
        );
      }
      const remote = parseCloudProject(result.project, id);
      try {
        store.set(workspaceAtom, (workspace) => ({
          ...workspace,
          projects: workspace.projects.map((latest) =>
            latest.id === id
              ? previous
                ? reconcileProjectRecord(latest, remote, previous.project)
                : mergeProjectRecord(latest, remote)
              : latest,
          ),
        }));
      } catch (error) {
        throw new ProjectConflictError(id, errorMessage(error));
      }
      acknowledged.set(id, { project: remote, hash: result.hash });
    }
    throw new Error("This project keeps changing on another device. Retry sync to continue.");
  };

  const remove = async (id: string) => {
    assertActive();
    if (unsupported.has(id)) throw unsupported.get(id);
    const previous = acknowledged.get(id);
    if (!previous) return;
    const result = await client.remove(id, previous.hash);
    assertActive();
    if (!result.saved) {
      throw new ProjectConflictError(
        id,
        "This project changed on another device. Reload before deleting it.",
      );
    }
    acknowledged.delete(id);
  };

  const flush = (): Promise<void> => {
    cancelTimer();
    if (stopped) return Promise.reject(new Error("Project sync is no longer active."));
    if (!ready) return Promise.reject(new Error("Cloud projects have not finished loading."));
    if (inFlight) return inFlight;
    inFlight = serialize(async () => {
      const failures: { error: unknown; projectId?: string }[] = [];
      try {
        while (dirty()) {
          assertActive();
          if (navigator.onLine === false) {
            throw new Error(
              "Offline: edits are only in memory. Keep this tab open until cloud sync succeeds.",
            );
          }
          status({ state: "syncing" });
          for (const project of store.get(workspaceAtom).projects) {
            try {
              await writeProject(project.id);
            } catch (error) {
              failures.push({ error, projectId: project.id });
            }
          }
          for (const id of acknowledged.keys()) {
            if (!unsupported.has(id) && !currentProject(id)) {
              try {
                await remove(id);
              } catch (error) {
                failures.push({ error, projectId: id });
              }
            }
          }
          if (failures.length) break;
          const error = pendingVersionError();
          if (error) failures.push({ error, projectId: error.projectId });
          if (failures.length) break;
        }
        if (failures.length) {
          const { error, projectId } = failures[0];
          status({
            ...projectSyncErrorStatus(error),
            ...(projectId ? { projectId } : {}),
          });
          throw error;
        }
        settledStatus();
      } catch (error) {
        // A failed attempt (including offline) is an error; pending means debounce only.
        status(projectSyncErrorStatus(error));
        throw error;
      }
    }).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  // Background failures are already surfaced by flush through the status atom.
  const backgroundFlush = () => {
    if (!ready || stopped) return;
    void flush().catch(() => {});
  };
  const schedule = () => {
    if (!ready || stopped || applyingRemote || !dirty()) return;
    const error = versionError();
    const currentStatus = store.get(projectSyncStatusAtom);
    if (currentStatus.state === "error" && currentStatus.projectId) {
      cancelTimer();
      timer = setTimeout(backgroundFlush, SAVE_DEBOUNCE_MS);
      return;
    }
    status(
      error
        ? { state: "error", message: error.message }
        : {
            state: "pending",
            message: "Unsaved edits are only in memory until cloud sync succeeds.",
          },
    );
    cancelTimer();
    timer = setTimeout(backgroundFlush, SAVE_DEBOUNCE_MS);
  };
  const unsubscribe = store.sub(workspaceAtom, schedule);
  const refresh = (): Promise<void> => {
    if (stopped) return Promise.reject(new Error("Project sync is no longer active."));
    if (!ready) return Promise.reject(new Error("Cloud projects have not finished loading."));
    if (refreshing) return refreshing;
    refreshing = serialize(async () => {
      try {
        if (navigator.onLine === false)
          throw new Error("Offline: could not refresh cloud projects.");
        const snapshot = parseRemoteProjects(await client.load());
        assertActive();
        unsupported.clear();
        for (const [id, error] of snapshot.unsupported) unsupported.set(id, error);
        // Read Jotai after the request: edits made while fetching must participate in reconciliation.
        const result = reconcileRemoteProjects(
          store.get(workspaceAtom),
          acknowledged,
          snapshot.remote,
          new Set(unsupported.keys()),
        );
        acknowledged.clear();
        for (const [id, row] of result.acknowledged) acknowledged.set(id, row);
        applyingRemote = true;
        try {
          store.set(workspaceAtom, result.workspace);
        } finally {
          applyingRemote = false;
        }
        if (dirty()) schedule();
        else settledStatus();
      } catch (error) {
        status(projectSyncErrorStatus(error));
        throw error;
      }
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  };
  // Errors are surfaced by refresh/flush; hidden tabs neither poll nor fetch on focus.
  const backgroundRefresh = () => {
    if (!ready || stopped || document.visibilityState !== "visible" || !navigator.onLine) return;
    void refresh()
      .then(backgroundFlush)
      .catch(() => {});
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") backgroundFlush();
    else backgroundRefresh();
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty()) return;
    backgroundFlush();
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("online", backgroundRefresh);
  window.addEventListener("focus", backgroundRefresh);
  window.addEventListener("pagehide", backgroundFlush);
  window.addEventListener("beforeunload", beforeUnload);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const poll = setInterval(backgroundRefresh, PROJECT_REFRESH_INTERVAL_MS);

  const load = async () => {
    status({ state: "loading" });
    try {
      const rows = await client.load();
      assertActive();
      const { remote, unsupported: blocked } = parseRemoteProjects(rows);
      unsupported.clear();
      for (const [id, error] of blocked) unsupported.set(id, error);
      acknowledged.clear();
      for (const [id, row] of remote) acknowledged.set(id, row);
      const projects = [...remote.values()].map(({ project }) => project);
      store.set(workspaceAtom, {
        version: 1,
        activeProjectId: mostRecent(projects)?.id ?? null,
        projects,
      });
      ready = true;
      settledStatus();
    } catch (error) {
      status({ state: "error", message: errorMessage(error) });
      throw error;
    }
  };

  const migrateLocalProjects = async () => {
    // Explicit consent is handled by the UI. Retain every source until its save is acknowledged.
    await flush();
    const sources = readLocalProjectSources();
    if (!sources.length) throw new Error("There are no readable local projects to migrate.");
    for (const source of sources) {
      assertActive();
      const incoming = parseCloudProject(source.project);
      const workspace = store.get(workspaceAtom);
      const existing = workspace.projects.find(
        (project) =>
          project.importedFrom?.kind === "local-migration" &&
          project.importedFrom.sourceProjectId === incoming.id,
      );
      const imported =
        existing ??
        forkProjectRecord(incoming, {
          kind: "local-migration",
          sourceProjectId: incoming.id,
        });
      store.set(workspaceAtom, {
        ...workspace,
        projects: existing ? workspace.projects : [...workspace.projects, imported],
        activeProjectId: workspace.activeProjectId ?? imported.id,
      });
      await flush();
      assertActive();
      source.remove();
    }
  };

  return {
    load,
    flush,
    refresh,
    async keepProjectChanges(id: string) {
      const original = currentProject(id);
      if (!original) throw new Error("This project is no longer available in this tab.");
      await serialize(async () => {
        try {
          const snapshot = parseRemoteProjects(await client.load());
          assertActive();
          const future = snapshot.unsupported.get(id);
          if (future) {
            unsupported.set(id, future);
            throw future;
          }
          if (currentProject(id) !== original) {
            throw new Error("This project changed while resolving the conflict. Review it again.");
          }
          const project = currentProject(id);
          if (!project) throw new Error("This project is no longer available in this tab.");
          const hash = await hashProject(project);
          assertActive();
          const latest = snapshot.remote.get(id);
          const result = await client.save(project, hash, latest?.hash ?? null);
          assertActive();
          if (!result.saved || !result.hash || !result.project) {
            throw new ProjectConflictError(
              id,
              "The cloud project changed again. Review the latest version before overwriting it.",
            );
          }
          parseCloudProject(result.project, id);
          acknowledged.set(id, { project, hash: result.hash });
          unsupported.delete(id);
          settledStatus();
        } catch (error) {
          status({
            ...projectSyncErrorStatus(error),
            ...(error instanceof UnsupportedProjectVersionError ? {} : { projectId: id }),
          });
          throw error;
        }
      });
    },
    async discardProjectChanges(id: string) {
      const original = currentProject(id);
      await serialize(async () => {
        try {
          const snapshot = parseRemoteProjects(await client.load());
          assertActive();
          const versionError = snapshot.unsupported.get(id);
          if (versionError) {
            unsupported.set(id, versionError);
            throw versionError;
          }
          const remote = snapshot.remote.get(id);
          if (currentProject(id) !== original) {
            throw new Error(
              "This project changed while discarding edits. Review it before trying again.",
            );
          }
          applyingRemote = true;
          try {
            if (remote) {
              acknowledged.set(id, remote);
              store.set(workspaceAtom, (workspace) => ({
                ...workspace,
                projects: currentProject(id)
                  ? workspace.projects.map((project) =>
                      project.id === id ? remote.project : project,
                    )
                  : [...workspace.projects, remote.project],
              }));
            } else {
              acknowledged.delete(id);
              store.set(workspaceAtom, (workspace) => deleteProject(workspace, id));
            }
          } finally {
            applyingRemote = false;
          }
          if (dirty()) schedule();
          else settledStatus();
        } catch (error) {
          status({
            state: "error",
            message: errorMessage(error),
            ...(error instanceof UnsupportedProjectVersionError ? {} : { projectId: id }),
          });
          throw error;
        }
      });
    },
    migrateLocalProjects,
    getPendingProjects() {
      return store
        .get(workspaceAtom)
        .projects.filter((project) => acknowledged.get(project.id)?.project !== project);
    },
    async remove(id: string) {
      await serialize(async () => {
        try {
          if (acknowledged.has(id) && currentProject(id)) await writeProject(id);
          await remove(id);
          // Commit locally in the same operation so a queued refresh cannot resurrect this row.
          store.set(workspaceAtom, (workspace) => deleteProject(workspace, id));
          if (dirty()) schedule();
          else settledStatus();
        } catch (error) {
          status(projectSyncErrorStatus(error));
          throw error;
        }
      });
    },
    hasPendingChanges: dirty,
    stop() {
      stopped = true;
      cancelTimer();
      clearInterval(poll);
      unsubscribe();
      window.removeEventListener("online", backgroundRefresh);
      window.removeEventListener("focus", backgroundRefresh);
      window.removeEventListener("pagehide", backgroundFlush);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
