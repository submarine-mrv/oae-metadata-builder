import type { WorkspaceStore } from "@/workspace/storage";
import type { Workspace } from "@/workspace/types";
import { workspaceAtom } from "./atoms";
import type { AppStore } from "./store";

export const SAVE_DEBOUNCE_MS = 2000;

/** Creating, deleting or switching a project changes the ids or the active id. */
function isStructural(a: Workspace, b: Workspace): boolean {
  if (a.activeProjectId !== b.activeProjectId) return true;
  if (a.projects.length !== b.projects.length) return true;
  const ids = new Set(a.projects.map((p) => p.id));
  return b.projects.some((p) => !ids.has(p.id));
}

/**
 * Saves the workspace whenever it changes: structural changes at once, edits
 * after a 2 s debounce. Pending edits are flushed when the page is hidden or
 * unloaded. Returns a function that stops saving and removes the listeners.
 */
export function startPersistence(store: AppStore, workspaceStore: WorkspaceStore): () => void {
  let synced = store.get(workspaceAtom);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const persist = (ws: Workspace) => {
    cancel();
    workspaceStore.save(ws);
    synced = ws;
  };

  const flush = () => {
    const current = store.get(workspaceAtom);
    if (current !== synced) persist(current);
  };

  const unsubscribe = store.sub(workspaceAtom, () => {
    const current = store.get(workspaceAtom);
    if (current === synced) return;
    if (isStructural(synced, current)) {
      persist(current);
      return;
    }
    cancel();
    timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
  });

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    unsubscribe();
    cancel();
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
