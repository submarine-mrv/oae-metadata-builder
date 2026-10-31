import { workspaceAtom } from "@/state/atoms";
import { SAVE_DEBOUNCE_MS } from "@/state/persistence";
import type { AppStore } from "@/state/store";
import { mergeProjectRecord, reconcileProjectRecord } from "../merge";
import { readLocalProjectSources } from "../storage";
import {
  type ProjectSyncStatus,
  projectSyncStatusAtom,
  type RemoteDeletion,
  remoteDeletionsAtom,
} from "../syncState";
import { type ProjectRecord, projectDisplayName } from "../types";
import { deleteProject, mostRecent } from "../workspace";
import {
  checkProjectVersion,
  errorMessage,
  hashProject,
  parseCloudProject,
  UnsupportedProjectVersionError,
} from "./helper";
import type { ProjectCloudClient, ProjectSaveResult, RemoteProject } from "./types";

const SUSTAINED_FAILURE_MS = 30_000;
const MAX_RETRY_MS = 60_000;

/** Other writers kept saving between our merge and resave. */
class ContentionError extends Error {}
/** A request to the cloud failed; retrying it unchanged may succeed. */
class RequestError extends Error {}
/** Several projects failed in one flush; the others still saved. */
class FlushFailures extends Error {
  constructor(readonly failures: unknown[]) {
    super(errorMessage(failures[0]));
  }
}

const retryable = (error: unknown) =>
  error instanceof ContentionError || error instanceof RequestError;

/** Entities in `before` that `after` no longer has. */
function removedEntities(before: ProjectRecord, after: ProjectRecord): RemoteDeletion[] {
  const gone = <T extends { id: number; name: string }>(from: T[], to: T[]) =>
    from.filter((entity) => !to.some((kept) => kept.id === entity.id));
  return [
    ...gone(before.state.experiments, after.state.experiments).map((entity) => ({
      type: "experiment" as const,
      name: entity.name,
    })),
    ...gone(before.state.datasets, after.state.datasets).map((entity) => ({
      type: "dataset" as const,
      name: entity.name,
    })),
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
    status(error ? { state: "error", message: error.message } : { state: "synced" });
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
      if (unsupported.has(id) || !project || previous?.project === project) return;
      checkProjectVersion(project);
      const hash = await hashProject(project);
      assertActive();
      let result: ProjectSaveResult;
      try {
        result = await client.save(project, hash, previous?.hash ?? null);
      } catch (error) {
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
        noteDeletions([{ type: "project", name: projectDisplayName(project.state) }]);
        return;
      }
      const remote = parseCloudProject(result.project, id);
      const latest = currentProject(id) ?? project;
      const merged = previous
        ? reconcileProjectRecord(latest, remote, previous.project)
        : mergeProjectRecord(latest, remote);
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((record) => (record.id === id ? merged : record)),
      }));
      noteDeletions(removedEntities(latest, merged));
      acknowledged.set(id, { project: remote, hash: result.hash });
    }
    throw new ContentionError("This project keeps changing elsewhere. Retry sync to continue.");
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
        throw new ContentionError("This project keeps changing elsewhere. Retrying the delete.");
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
            throw new Error(
              "Offline: edits are only in memory. Keep this tab open until cloud sync succeeds.",
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
          // Conflicts, newer drafts and offline need the user or the online event.
          status({ state: "error", message: errorMessage(error) });
        } else {
          status(
            Date.now() - failingSince < SUSTAINED_FAILURE_MS
              ? {
                  state: "pending",
                  message: "Unsaved edits are only in memory until cloud sync succeeds.",
                }
              : {
                  state: "error",
                  message:
                    error instanceof ContentionError
                      ? "This project keeps being saved elsewhere. Your changes are safe in this tab and will keep retrying."
                      : `Can't reach the cloud right now. Your changes are safe in this tab and will keep retrying. (${errorMessage(error)})`,
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

  // Background failures are already surfaced by flush through the status atom.
  const backgroundFlush = () => {
    if (!ready || stopped) return;
    void flush().catch(() => {});
  };
  const schedule = () => {
    if (!ready || stopped || !dirty()) return;
    const error = versionError();
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
  const onHidden = () => {
    if (document.visibilityState === "hidden") backgroundFlush();
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty()) return;
    backgroundFlush();
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("online", backgroundFlush);
  window.addEventListener("pagehide", backgroundFlush);
  window.addEventListener("beforeunload", beforeUnload);
  document.addEventListener("visibilitychange", onHidden);

  const load = async () => {
    status({ state: "loading" });
    try {
      const rows = await client.load();
      assertActive();
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
      const publicId = incoming.state.projectData.project_id;
      const existing = workspace.projects.find(
        (project) =>
          project.id === incoming.id ||
          (typeof publicId === "string" &&
            publicId.trim() !== "" &&
            project.state.projectData.project_id === publicId),
      );
      const merged = existing ? mergeProjectRecord(existing, incoming) : incoming;
      store.set(workspaceAtom, {
        ...workspace,
        projects: existing
          ? workspace.projects.map((project) => (project.id === existing.id ? merged : project))
          : [...workspace.projects, merged],
        activeProjectId: workspace.activeProjectId ?? merged.id,
      });
      await flush();
      assertActive();
      source.remove();
    }
  };

  return {
    load,
    flush,
    migrateLocalProjects,
    async remove(id: string) {
      await flush();
      await remove(id);
    },
    hasPendingChanges: dirty,
    stop() {
      stopped = true;
      cancelTimer();
      unsubscribe();
      window.removeEventListener("online", backgroundFlush);
      window.removeEventListener("pagehide", backgroundFlush);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onHidden);
    },
  };
}
