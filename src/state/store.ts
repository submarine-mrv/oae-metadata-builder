import { createStore } from "jotai";
import { parseProjectState } from "@/utils/parseProjectState";
import type { WorkspaceStore } from "@/workspace/storage";
import { emptyWorkspace } from "@/workspace/workspace";
import { workspaceAtom } from "./atoms";

export type AppStore = ReturnType<typeof createStore>;

export const appStore: AppStore = createStore();

/** Loads the saved workspace into the store, parsing each project at the boundary. */
export function hydrate(store: AppStore, workspaceStore: WorkspaceStore): void {
  const loaded = workspaceStore.load() ?? emptyWorkspace();
  store.set(workspaceAtom, {
    ...loaded,
    projects: loaded.projects.map((p) => ({ ...p, state: parseProjectState(p.state) })),
  });
}
