import { workspaceAtom } from "@/state/atoms";
import { SAVE_DEBOUNCE_MS } from "@/state/persistence";
import type { AppStore } from "@/state/store";
import { mergeProjectRecord, reconcileProjectRecord } from "../merge";
import { readLocalProjectSources } from "../storage";
import { type ProjectSyncStatus, projectSyncStatusAtom } from "../syncState";
import { mostRecent } from "../workspace";
import { errorMessage, hashProject, parseCloudProject } from "./helper";
import type { ProjectCloudClient, RemoteProject } from "./types";

export function startProjectCloudSync(store: AppStore, client: ProjectCloudClient) {
  const acknowledged = new Map<string, RemoteProject>();
  let stopped = false;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  const status = (value: ProjectSyncStatus) => {
    if (!stopped) store.set(projectSyncStatusAtom, value);
  };
  const cancelTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const currentProject = (id: string) =>
    store.get(workspaceAtom).projects.find((project) => project.id === id);
  const dirty = () =>
    ready &&
    (store
      .get(workspaceAtom)
      .projects.some((project) => acknowledged.get(project.id)?.project !== project) ||
      [...acknowledged.keys()].some((id) => !currentProject(id)));

  const assertActive = () => {
    if (stopped) throw new Error("The account changed before project sync completed.");
  };

  const writeProject = async (id: string) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      assertActive();
      const project = currentProject(id);
      const previous = acknowledged.get(id);
      if (!project || previous?.project === project) return;
      const hash = await hashProject(project);
      assertActive();
      const result = await client.save(project, hash, previous?.hash ?? null);
      assertActive();
      if (result.saved) {
        if (!result.hash) throw new Error("The cloud did not acknowledge the saved project.");
        acknowledged.set(id, { project, hash: result.hash });
        return;
      }
      if (!result.project || !result.hash) {
        throw new Error(
          "This project was deleted on another device. Export your edits to keep them.",
        );
      }
      const remote = parseCloudProject(result.project, id);
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
      acknowledged.set(id, { project: remote, hash: result.hash });
    }
    throw new Error("This project keeps changing on another device. Retry sync to continue.");
  };

  const remove = async (id: string) => {
    assertActive();
    const previous = acknowledged.get(id);
    if (!previous) return;
    const result = await client.remove(id, previous.hash);
    assertActive();
    if (!result.saved) {
      throw new Error("This project changed on another device. Reload before deleting it.");
    }
    acknowledged.delete(id);
  };

  const flush = (): Promise<void> => {
    cancelTimer();
    if (stopped) return Promise.reject(new Error("Project sync is no longer active."));
    if (!ready) return Promise.reject(new Error("Cloud projects have not finished loading."));
    if (inFlight) return inFlight;
    if (!dirty()) return Promise.resolve();
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
          for (const project of store.get(workspaceAtom).projects) {
            await writeProject(project.id);
          }
          for (const id of acknowledged.keys()) {
            if (!currentProject(id)) await remove(id);
          }
        }
        status({ state: "synced" });
      } catch (error) {
        // A failed attempt (including offline) is an error; pending means debounce only.
        status({
          state: "error",
          message: errorMessage(error),
        });
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
    status({
      state: "pending",
      message: "Unsaved edits are only in memory until cloud sync succeeds.",
    });
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
      const projects = rows.map(({ project, hash }) => {
        const parsed = parseCloudProject(project);
        acknowledged.set(parsed.id, { project: parsed, hash });
        return parsed;
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
      status({ state: "synced" });
    } catch (error) {
      status({ state: "error", message: errorMessage(error) });
      throw error;
    }
  };

  const migrateLocalProjects = async () => {
    // Explicit consent is handled by the UI. Retain every source until its save is acknowledged.
    await flush();
    const sources = readLocalProjectSources();
    if (!sources.length)
      throw new Error("There are no readable local projects to migrate.");
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
