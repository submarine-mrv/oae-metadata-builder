import { workspaceAtom } from "@/state/atoms";
import { SAVE_DEBOUNCE_MS } from "@/state/persistence";
import type { AppStore } from "@/state/store";
import { adoptUnseenProject, equalData, reconcileProjectRecord } from "../merge";
import { readLocalProjectSources } from "../storage";
import {
  ProjectConflictError,
  type ProjectSyncStatus,
  projectAccessAtom,
  projectSyncErrorStatus,
  projectSyncStatusAtom,
  type RemoteDeletion,
  refreshPausesAtom,
  remoteDeletionsAtom,
} from "../syncState";
import { type ProjectRecord, projectDisplayName } from "../types";
import { deleteProject, mostRecent } from "../workspace";
import {
  checkProjectVersion,
  errorMessage,
  hashProject,
  ProjectAccessError,
  parseCloudProject,
  UnsupportedProjectVersionError,
} from "./helper";
import type {
  CloudProject,
  ProjectAccess,
  ProjectCloudClient,
  ProjectSaveResult,
  RemoteProject,
} from "./types";

const SUSTAINED_FAILURE_MS = 30_000;
/** How often a visible tab checks for changes made elsewhere. */
export const REFRESH_INTERVAL_MS = 60_000;
/** How often a visible tab with a shared project open checks for changes. */
export const SHARED_REFRESH_INTERVAL_MS = 10_000;
const MAX_RETRY_MS = 60_000;

/** Other writers kept saving between our merge and resave. */
class ContentionError extends Error {}
/** A request to the cloud failed; retrying it unchanged may succeed. */
class RequestError extends Error {}
class OfflineError extends RequestError {}
/** Several projects failed in one flush; the others still saved. */
class FlushFailures extends Error {
  constructor(readonly failures: unknown[]) {
    super(errorMessage(failures[0]));
  }
}

const retryable = (error: unknown) =>
  error instanceof ContentionError || error instanceof RequestError;

/** Entities in `before` that `after` no longer has, flagged when edited since `baseline`. */
function removedEntities(
  before: ProjectRecord,
  after: ProjectRecord,
  baseline?: ProjectRecord,
): RemoteDeletion[] {
  const gone = <T extends { id: string; name: string }>(
    type: "experiment" | "dataset",
    from: T[],
    to: T[],
    saved: T[] = [],
  ): RemoteDeletion[] =>
    from
      .filter((entity) => !to.some((kept) => kept.id === entity.id))
      .map((entity) => {
        const original = saved.find((item) => item.id === entity.id);
        return {
          type,
          name: entity.name,
          projectId: before.id,
          id: entity.id,
          ...(original && !equalData(original, entity) ? { unsavedEdits: true as const } : {}),
        };
      });
  return [
    ...gone(
      "experiment",
      before.state.experiments,
      after.state.experiments,
      baseline?.state.experiments,
    ),
    ...gone("dataset", before.state.datasets, after.state.datasets, baseline?.state.datasets),
  ];
}

/** Random 0.5–3s: breaks lockstep with another writer without widening the save window. */
const contentionDelay = () => 500 + Math.random() * 2_500;
/** 5s doubling to 60s, jittered so failed clients don't retry together. */
const requestDelay = (failures: number) => {
  const ceiling = Math.min(MAX_RETRY_MS, 5_000 * 2 ** failures);
  return ceiling / 2 + Math.random() * (ceiling / 2);
};

export function startProjectCloudSync(store: AppStore, client: ProjectCloudClient) {
  const acknowledged = new Map<string, RemoteProject>();
  const unsupported = new Map<string, UnsupportedProjectVersionError>();
  const versionError = () => unsupported.values().next().value;
  const settledStatus = () => {
    const error = versionError();
    status(error ? projectSyncErrorStatus(error) : { state: "synced" });
  };
  let stopped = false;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let failingSince: number | null = null;
  let requestFailures = 0;

  const status = (value: ProjectSyncStatus) => {
    if (!stopped) store.set(projectSyncStatusAtom, value);
  };
  const cancelTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const paused = () => store.get(refreshPausesAtom) > 0;
  const currentProject = (id: string) =>
    store.get(workspaceAtom).projects.find((project) => project.id === id);
  const pendingVersionError = () => {
    for (const [id, error] of unsupported) {
      if (currentProject(id) !== acknowledged.get(id)?.project) return error;
    }
  };
  const accessOf = (id: string): ProjectAccess | undefined => store.get(projectAccessAtom)[id];
  // Viewers' copies never save; anything they change locally is replaced on refresh.
  const isViewer = (id: string) => accessOf(id)?.role === "viewer";
  /** Replaces the access map, or with `merge` updates only the given projects. */
  const updateAccess = (entries: [string, ProjectAccess | undefined][], merge = false) => {
    const next = {
      ...(merge ? store.get(projectAccessAtom) : {}),
      ...Object.fromEntries(
        entries.filter((entry): entry is [string, ProjectAccess] => entry[1] !== undefined),
      ),
    };
    if (!equalData(next, store.get(projectAccessAtom))) store.set(projectAccessAtom, next);
  };
  const dirty = () =>
    ready &&
    (store
      .get(workspaceAtom)
      .projects.some(
        (project) => !isViewer(project.id) && acknowledged.get(project.id)?.project !== project,
      ) ||
      [...acknowledged.keys()].some((id) => !currentProject(id)));

  const noteDeletions = (deletions: RemoteDeletion[]) => {
    if (deletions.length && !stopped) {
      store.set(remoteDeletionsAtom, (previous) => [...previous, ...deletions]);
    }
  };

  const assertActive = () => {
    if (stopped) throw new Error("The account changed before project sync completed.");
  };

  const writeProject = async (id: string) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      assertActive();
      const project = currentProject(id);
      const previous = acknowledged.get(id);
      if (unsupported.has(id) || !project || previous?.project === project || isViewer(id)) {
        return;
      }
      checkProjectVersion(project);
      const hash = await hashProject(project);
      assertActive();
      let result: ProjectSaveResult;
      try {
        result = await client.save(project, hash, previous?.hash ?? null);
      } catch (error) {
        if (error instanceof ProjectAccessError) throw error;
        if (!(error instanceof UnsupportedProjectVersionError)) {
          throw new RequestError(errorMessage(error), { cause: error });
        }
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
        // Deleted elsewhere: the delete wins over local edits.
        acknowledged.delete(id);
        store.set(workspaceAtom, (workspace) => deleteProject(workspace, id));
        noteDeletions([
          {
            type: "project",
            name: projectDisplayName(project.state),
            projectId: id,
            unsavedEdits: true,
          },
        ]);
        return;
      }
      const remote = parseCloudProject(result.project, id);
      const latest = currentProject(id) ?? project;
      let merged: ProjectRecord;
      try {
        merged = previous
          ? reconcileProjectRecord(latest, remote, previous.project)
          : adoptUnseenProject(latest, remote);
      } catch (error) {
        throw new ProjectConflictError(id, errorMessage(error));
      }
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((record) => (record.id === id ? merged : record)),
      }));
      noteDeletions(removedEntities(latest, merged, previous?.project));
      acknowledged.set(id, { project: remote, hash: result.hash });
    }
    throw new ContentionError(
      "This project keeps changing. Your changes are safe in this tab, and saving will keep retrying.",
    );
  };

  const remove = async (id: string) => {
    assertActive();
    if (unsupported.has(id)) throw unsupported.get(id);
    const previous = acknowledged.get(id);
    if (!previous) return;
    let expected = previous.hash;
    for (let attempt = 0; ; attempt++) {
      let result: ProjectSaveResult;
      try {
        result = await client.remove(id, expected);
      } catch (error) {
        throw new RequestError(errorMessage(error), { cause: error });
      }
      assertActive();
      // Gone already counts as deleted. Edited elsewhere: the delete wins, so retry at its hash.
      if (result.saved || !result.hash) break;
      if (attempt === 3) {
        throw new ContentionError("This project keeps changing. Retrying the delete.");
      }
      expected = result.hash;
    }
    acknowledged.delete(id);
    // Drop it locally too, or a flush in between would re-create the row.
    store.set(workspaceAtom, (workspace) => deleteProject(workspace, id));
  };

  const flush = (): Promise<void> => {
    cancelTimer();
    if (stopped) return Promise.reject(new Error("Project sync is no longer active."));
    if (!ready) return Promise.reject(new Error("Cloud projects have not finished loading."));
    if (inFlight) return inFlight;
    if (!dirty()) {
      settledStatus();
      return Promise.resolve();
    }
    inFlight = Promise.resolve().then(async () => {
      try {
        while (dirty()) {
          assertActive();
          if (navigator.onLine === false) {
            throw new OfflineError(
              "Offline. Your edits are kept in this tab and will save when you reconnect.",
            );
          }
          status({ state: "syncing" });
          // One project's failure must not hold back saves and deletes for the others.
          const failures: unknown[] = [];
          const attempt = async (work: () => Promise<void>) => {
            try {
              await work();
            } catch (error) {
              assertActive();
              failures.push(error);
            }
          };
          for (const project of store.get(workspaceAtom).projects) {
            await attempt(() => writeProject(project.id));
          }
          for (const id of [...acknowledged.keys()]) {
            if (!unsupported.has(id) && !currentProject(id)) await attempt(() => remove(id));
          }
          const versionError = pendingVersionError();
          if (versionError) failures.push(versionError);
          if (failures.length) throw new FlushFailures(failures);
        }
        failingSince = null;
        requestFailures = 0;
        settledStatus();
      } catch (caught) {
        const failures = caught instanceof FlushFailures ? caught.failures : [caught];
        // Show what needs the user first; anything retryable still gets its timer.
        const error = failures.find((failure) => !retryable(failure)) ?? failures[0];
        const retryIn = failures.some((failure) => failure instanceof RequestError)
          ? requestDelay(requestFailures++)
          : failures.some(retryable)
            ? contentionDelay()
            : null;
        if (retryIn !== null && !stopped) {
          failingSince ??= Date.now();
          cancelTimer();
          timer = setTimeout(backgroundFlush, retryIn);
        }
        if (!retryable(error) || failingSince === null) {
          // Conflicts and newer drafts need the user.
          status(projectSyncErrorStatus(error));
        } else {
          status(
            Date.now() - failingSince < SUSTAINED_FAILURE_MS
              ? {
                  state: "pending",
                  message: "Not saved yet. Retrying.",
                }
              : {
                  state: "error",
                  message:
                    error instanceof OfflineError
                      ? error.message
                      : error instanceof ContentionError
                        ? "This project keeps changing. Your changes are safe in this tab, and saving will keep retrying."
                        : "Can't save right now. Your changes are safe in this tab, and saving will keep retrying.",
                },
          );
        }
        throw error;
      } finally {
        inFlight = null;
      }
    });
    return inFlight;
  };

  // Background failures are already surfaced by flush through the status atom. An open editor
  // holding a draft pauses background saves too, since a merge would replace its data.
  const backgroundFlush = () => {
    if (!ready || stopped || paused()) return;
    void flush().catch(() => {});
  };
  const schedule = () => {
    if (!ready || stopped || !dirty()) return;
    // While saves are failing, new edits wait for the retry already scheduled.
    if (failingSince !== null && timer !== null) return;
    const error = versionError();
    status(
      error
        ? projectSyncErrorStatus(error)
        : {
            state: "pending",
            message: "Not saved yet. Retrying.",
          },
    );
    cancelTimer();
    timer = setTimeout(backgroundFlush, SAVE_DEBOUNCE_MS);
  };
  /** Applies changes made elsewhere. A project with unsaved edits waits for its next save to merge. */
  const applyRemote = (rows: CloudProject[]) => {
    const previousAccess = store.get(projectAccessAtom);
    updateAccess(
      rows.map((row) => ["projectId" in row ? row.projectId : row.project.id, row.access]),
    );
    let workspace = store.get(workspaceAtom);
    const deletions: RemoteDeletion[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if ("projectId" in row) {
        seen.add(row.projectId);
        if (unsupported.has(row.projectId)) continue;
        unsupported.set(
          row.projectId,
          new UnsupportedProjectVersionError(row.projectId, row.schemaVersion, row.reason),
        );
        // Hidden like at load, unless this tab has edits the version error has to protect.
        const local = workspace.projects.find((project) => project.id === row.projectId);
        if (local && local === acknowledged.get(row.projectId)?.project) {
          workspace = deleteProject(workspace, row.projectId);
        }
        acknowledged.delete(row.projectId);
        continue;
      }
      const { project: remote, hash } = row;
      seen.add(remote.id);
      const known = acknowledged.get(remote.id);
      if (known?.hash === hash) continue;
      const local = workspace.projects.find((project) => project.id === remote.id);
      if (!known) {
        if (!local) {
          workspace = { ...workspace, projects: [...workspace.projects, remote] };
          acknowledged.set(remote.id, { project: remote, hash });
        }
        continue;
      }
      // Gone here is a delete still on its way; edited here merges on the next save.
      if (!local || (local !== known.project && !isViewer(remote.id))) continue;
      deletions.push(...removedEntities(local, remote));
      workspace = {
        ...workspace,
        projects: workspace.projects.map((project) =>
          project.id === remote.id ? remote : project,
        ),
      };
      acknowledged.set(remote.id, { project: remote, hash });
    }
    for (const [id, known] of acknowledged) {
      if (seen.has(id)) continue;
      // Deleted elsewhere: the delete wins over local edits.
      const local = workspace.projects.find((project) => project.id === id);
      if (local) {
        const shared = (previousAccess[id]?.role ?? "owner") !== "owner";
        deletions.push({
          type: "project",
          name: projectDisplayName(local.state),
          projectId: id,
          ...(shared ? { reason: "access" as const } : {}),
          ...(local !== known.project ? { unsavedEdits: true as const } : {}),
        });
        workspace = deleteProject(workspace, id);
      }
      acknowledged.delete(id);
    }
    if (workspace !== store.get(workspaceAtom)) store.set(workspaceAtom, workspace);
    noteDeletions(deletions);
  };

  let refreshing: Promise<void> | null = null;
  let lastRefresh = 0;
  /** Checks hashes first and loads projects only when something changed. Skipped while saving. */
  const refresh = (maxAgeMs = 0): Promise<void> => {
    if (!ready || stopped || inFlight || paused()) return Promise.resolve();
    if (refreshing) return refreshing;
    if (Date.now() - lastRefresh < maxAgeMs) return Promise.resolve();
    lastRefresh = Date.now();
    refreshing = (async () => {
      try {
        const versions = await client.hashes();
        assertActive();
        // Roles and who saved last can change without the draft changing.
        const known = [...versions].filter(([id]) => acknowledged.has(id));
        updateAccess(
          known.map(([id, version]) => [id, version.access]),
          true,
        );
        // Someone downgraded to viewer keeps no local changes, even if the draft didn't change.
        const reverted = store.get(workspaceAtom).projects.map((record) => {
          const saved = acknowledged.get(record.id)?.project;
          return isViewer(record.id) && saved && saved !== record ? saved : record;
        });
        if (reverted.some((record, index) => record !== store.get(workspaceAtom).projects[index])) {
          store.set(workspaceAtom, (workspace) => ({ ...workspace, projects: reverted }));
          if (!dirty()) settledStatus();
        }
        const changed =
          [...versions].some(
            ([id, version]) => !unsupported.has(id) && acknowledged.get(id)?.hash !== version.hash,
          ) || [...acknowledged.keys()].some((id) => !versions.has(id));
        if (!changed) return;
        const before = new Map(acknowledged);
        const rows = await client.load();
        assertActive();
        // A save finished meanwhile, so these rows may be older than what this tab knows.
        const saved =
          before.size !== acknowledged.size ||
          [...acknowledged].some(([id, known]) => before.get(id) !== known);
        if (inFlight || saved || paused()) return;
        applyRemote(rows);
        if (!dirty()) settledStatus();
      } catch (error) {
        // The next trigger tries again; saves report their own failures.
        console.warn("Could not check for changes made elsewhere:", error);
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  };
  const syncNow = () => {
    if (!ready || stopped || paused()) return;
    void flush()
      .catch(() => {})
      .finally(() => void refresh());
  };

  /** Settles a conflict on one project by keeping this tab's version or taking the cloud's. */
  const resolveConflict = async (id: string, keep: boolean) => {
    await inFlight?.catch(() => {});
    cancelTimer();
    const rows = await client.load();
    assertActive();
    const row = rows.find((candidate) =>
      "projectId" in candidate ? candidate.projectId === id : candidate.project.id === id,
    );
    if (row && "projectId" in row) {
      throw new UnsupportedProjectVersionError(id, row.schemaVersion, row.reason);
    }
    const local = currentProject(id);
    const previous = acknowledged.get(id);
    if (row && local && previous) {
      // Settle only the clashing fields; other edits from both sides are kept.
      const merged = reconcileProjectRecord(
        local,
        row.project,
        previous.project,
        keep ? "local" : "remote",
      );
      acknowledged.set(id, row);
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((project) => (project.id === id ? merged : project)),
      }));
      noteDeletions(removedEntities(local, merged, previous.project));
    } else if (keep) {
      const project = currentProject(id);
      if (!project) throw new Error("This project is no longer open in this tab.");
      const hash = await hashProject(project);
      assertActive();
      const result = await client.save(project, hash, row?.hash ?? null);
      assertActive();
      if (!result.saved || !result.hash) {
        throw new ProjectConflictError(
          id,
          "It changed again while you were choosing. Look again before keeping yours.",
        );
      }
      acknowledged.set(id, { project, hash: result.hash });
    } else {
      if (row) {
        acknowledged.set(id, row);
        store.set(workspaceAtom, (workspace) => ({
          ...workspace,
          projects: workspace.projects.map((project) =>
            project.id === id ? row.project : project,
          ),
        }));
        if (local) noteDeletions(removedEntities(local, row.project, previous?.project));
      } else {
        acknowledged.delete(id);
        store.set(workspaceAtom, (workspace) => deleteProject(workspace, id));
        if (local) {
          noteDeletions([
            {
              type: "project",
              name: projectDisplayName(local.state),
              projectId: id,
              unsavedEdits: true,
            },
          ]);
        }
      }
    }
    // Saves anything else still waiting and clears the conflict status.
    await flush().catch(() => {});
  };

  const unsubscribe = store.sub(workspaceAtom, schedule);
  // Catch up as soon as the last editor holding a draft closes.
  const unsubscribePauses = store.sub(refreshPausesAtom, () => {
    if (!paused()) syncNow();
  });
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") backgroundFlush();
    else syncNow();
  };
  // Ticks at the shared rate; private projects check at most once per REFRESH_INTERVAL_MS.
  const poll = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const active = store.get(workspaceAtom).activeProjectId;
    const access = active ? accessOf(active) : undefined;
    const shared = access !== undefined && (access.role !== "owner" || access.memberCount > 0);
    void refresh(shared ? 0 : REFRESH_INTERVAL_MS);
  }, SHARED_REFRESH_INTERVAL_MS);
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty()) return;
    backgroundFlush();
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("online", syncNow);
  window.addEventListener("pagehide", backgroundFlush);
  window.addEventListener("beforeunload", beforeUnload);
  document.addEventListener("visibilitychange", onVisibilityChange);

  const load = async () => {
    status({ state: "loading" });
    try {
      const rows = await client.load();
      assertActive();
      updateAccess(
        rows.map((row) => ["projectId" in row ? row.projectId : row.project.id, row.access]),
      );
      const projects = rows.flatMap((row) => {
        if ("projectId" in row) {
          if (row.reason)
            console.warn(`Could not read cloud project ${row.projectId}:`, row.reason);
          unsupported.set(
            row.projectId,
            new UnsupportedProjectVersionError(row.projectId, row.schemaVersion, row.reason),
          );
          return [];
        }
        const { project, hash } = row;
        const parsed = parseCloudProject(project);
        acknowledged.set(parsed.id, { project: parsed, hash });
        return [parsed];
      });
      if (new Set(projects.map((project) => project.id)).size !== projects.length) {
        throw new Error("The cloud returned duplicate project records.");
      }
      store.set(workspaceAtom, {
        version: 1,
        activeProjectId: mostRecent(projects)?.id ?? null,
        projects,
      });
      lastRefresh = Date.now();
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
      // Always a new project, so importing never changes one already in the account.
      const taken = workspace.projects.some((project) => project.id === incoming.id);
      const record = taken ? { ...incoming, id: crypto.randomUUID() } : incoming;
      store.set(workspaceAtom, {
        ...workspace,
        projects: [...workspace.projects, record],
        activeProjectId: workspace.activeProjectId ?? record.id,
      });
      await flush();
      assertActive();
      if (!acknowledged.has(record.id)) {
        throw new Error(
          `"${projectDisplayName(record.state)}" was deleted while importing. It's still in this browser.`,
        );
      }
      source.remove();
    }
  };

  return {
    load,
    flush,
    migrateLocalProjects,
    async remove(id: string) {
      // Wait for any save in progress, but a failure elsewhere mustn't block this delete.
      await flush().catch(() => {});
      await remove(id);
    },
    refresh,
    keepProjectChanges: (id: string) => resolveConflict(id, true),
    discardProjectChanges: (id: string) => resolveConflict(id, false),
    hasPendingChanges: dirty,
    stop() {
      stopped = true;
      cancelTimer();
      unsubscribe();
      unsubscribePauses();
      window.removeEventListener("online", syncNow);
      window.removeEventListener("pagehide", backgroundFlush);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(poll);
    },
  };
}
