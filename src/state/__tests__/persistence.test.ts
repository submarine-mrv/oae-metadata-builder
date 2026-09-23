import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceStore } from "@/workspace/storage";
import { emptyProjectState, newProjectRecord, type Workspace } from "@/workspace/types";
import { addProject, deleteProject, switchProject } from "@/workspace/workspace";
import { projectStateAtom, workspaceAtom } from "../atoms";
import { SAVE_DEBOUNCE_MS, startPersistence } from "../persistence";

function memoryStore() {
  let saved: Workspace | null = null;
  const store: WorkspaceStore & { saved: () => Workspace | null } = {
    load: () => saved,
    save: vi.fn((ws: Workspace) => {
      saved = ws;
    }),
    saved: () => saved,
  };
  return store;
}

const named = (research_project: string) => ({
  ...emptyProjectState(),
  projectData: { project_id: "", research_project },
});

const savedName = (ws: Workspace | null) => ws?.projects[0]?.state.projectData.research_project;

describe("startPersistence", () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  function start() {
    const store = createStore();
    const workspaceStore = memoryStore();
    stop = startPersistence(store, workspaceStore);
    return { store, workspaceStore };
  }

  function startWithProject() {
    const { store, workspaceStore } = start();
    const record = newProjectRecord();
    store.set(workspaceAtom, (ws) => addProject(ws, record));
    return { store, workspaceStore, id: record.id };
  }

  it("does not save the initial workspace", () => {
    const { workspaceStore } = start();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(workspaceStore.save).not.toHaveBeenCalled();
  });

  it("saves create, switch and delete immediately", () => {
    const { store, workspaceStore, id } = startWithProject();
    expect(workspaceStore.saved()?.projects.map((p) => p.id)).toEqual([id]);

    const second = newProjectRecord();
    store.set(workspaceAtom, (ws) => addProject(ws, second));
    store.set(workspaceAtom, (ws) => switchProject(ws, id));
    expect(workspaceStore.saved()?.activeProjectId).toBe(id);

    store.set(workspaceAtom, (ws) => deleteProject(ws, id));
    expect(workspaceStore.saved()?.projects.map((p) => p.id)).toEqual([second.id]);
    expect(workspaceStore.save).toHaveBeenCalledTimes(4);
  });

  it("saves an edit after the debounce", () => {
    const { store, workspaceStore } = startWithProject();
    store.set(projectStateAtom, named("Named"));
    expect(savedName(workspaceStore.saved())).toBeUndefined();

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(savedName(workspaceStore.saved())).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(savedName(workspaceStore.saved())).toBe("Named");
  });

  it("restarts the debounce on each edit and saves once", () => {
    const { store, workspaceStore } = startWithProject();
    vi.mocked(workspaceStore.save).mockClear();

    store.set(projectStateAtom, named("One"));
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 500);
    store.set(projectStateAtom, named("Two"));
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 500);
    expect(workspaceStore.save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(workspaceStore.save).toHaveBeenCalledTimes(1);
    expect(savedName(workspaceStore.saved())).toBe("Two");
  });

  it("saves a pending edit with the next structural change", () => {
    const { store, workspaceStore } = startWithProject();
    store.set(projectStateAtom, named("Pending"));
    store.set(workspaceAtom, (ws) => addProject(ws, newProjectRecord()));
    expect(savedName(workspaceStore.saved())).toBe("Pending");

    vi.mocked(workspaceStore.save).mockClear();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(workspaceStore.save).not.toHaveBeenCalled();
  });

  it("flushes an unsaved edit on pagehide", () => {
    const { store, workspaceStore } = startWithProject();
    store.set(projectStateAtom, named("Flushed"));
    window.dispatchEvent(new Event("pagehide"));
    expect(savedName(workspaceStore.saved())).toBe("Flushed");
  });

  it("flushes an unsaved edit when the page becomes hidden", () => {
    const { store, workspaceStore } = startWithProject();
    store.set(projectStateAtom, named("Hidden"));

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    try {
      document.dispatchEvent(new Event("visibilitychange"));
    } finally {
      // Removes the own property so the prototype getter applies again.
      delete (document as { visibilityState?: unknown }).visibilityState;
    }
    expect(savedName(workspaceStore.saved())).toBe("Hidden");
  });

  it("doesn't save on pagehide when nothing changed", () => {
    const { workspaceStore } = startWithProject();
    vi.mocked(workspaceStore.save).mockClear();
    window.dispatchEvent(new Event("pagehide"));
    expect(workspaceStore.save).not.toHaveBeenCalled();
  });

  it("stops saving once stopped", () => {
    const { store, workspaceStore } = startWithProject();
    vi.mocked(workspaceStore.save).mockClear();
    store.set(projectStateAtom, named("Late"));
    stop();

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    window.dispatchEvent(new Event("pagehide"));
    store.set(workspaceAtom, (ws) => addProject(ws, newProjectRecord()));
    expect(workspaceStore.save).not.toHaveBeenCalled();
  });
});
