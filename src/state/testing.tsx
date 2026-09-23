import { createStore, Provider } from "jotai";
import type React from "react";
import {
  emptyProjectState,
  newProjectRecord,
  type ProjectState,
  type Workspace,
} from "@/workspace/types";
import { addProject, emptyWorkspace } from "@/workspace/workspace";
import { type AppStore, hydrate } from "./store";

/** A fresh store hydrated from `seed`, or empty. */
export function createTestStore(seed?: Workspace): AppStore {
  const store = createStore();
  hydrate(store, { load: () => seed ?? null, save: () => {} });
  return store;
}

/** A workspace holding one active project. */
export function workspaceWithProject(state: ProjectState = emptyProjectState()): Workspace {
  return addProject(emptyWorkspace(), newProjectRecord(state));
}

export function StoreWrapper({ store, children }: { store: AppStore; children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}

/** A `wrapper` for render/renderHook bound to `store`. */
export function makeWrapper(store: AppStore = createTestStore()) {
  return ({ children }: { children: React.ReactNode }) => (
    <StoreWrapper store={store}>{children}</StoreWrapper>
  );
}
