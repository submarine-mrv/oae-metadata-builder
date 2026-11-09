import { notifications } from "@mantine/notifications";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { createTestStore, makeWrapper } from "@/state/testing";
import { projectSyncActionsAtom, projectSyncStatusAtom } from "../syncState";
import { newProjectRecord } from "../types";
import { useProjectTransition } from "../useProjectTransition";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));

describe("project transition save boundary", () => {
  it("keeps guest actions synchronous", () => {
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition, { wrapper: makeWrapper() });
    act(() => result.current(action));
    expect(action).toHaveBeenCalledOnce();
  });

  it("changes projects at once and saves in the background", () => {
    const store = createTestStore();
    const flush = vi.fn(() => new Promise<void>(() => {}));
    store.set(projectSyncActionsAtom, {
      flush,
      stop: vi.fn(),
      migrateLocalProjects: vi.fn(),
      remove: vi.fn(),
    });
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition, { wrapper: makeWrapper(store) });
    act(() => result.current(action));
    expect(action).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledOnce();
  });

  it("changes projects even when the save fails, leaving the error to the sync icon", async () => {
    const store = createTestStore();
    const flush = vi.fn().mockRejectedValue(new Error("not saved"));
    store.set(projectSyncActionsAtom, {
      flush,
      stop: vi.fn(),
      migrateLocalProjects: vi.fn(),
      remove: vi.fn(),
    });
    const status = store.get(projectSyncStatusAtom);
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition, { wrapper: makeWrapper(store) });
    await act(async () => result.current(action));
    expect(action).toHaveBeenCalledOnce();
    expect(store.get(projectSyncStatusAtom)).toBe(status);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("awaits conditional deletion before removing a project from Jotai", async () => {
    const store = createTestStore();
    const action = vi.fn();
    const remove = vi.fn().mockRejectedValue(new Error("remote conflict"));
    store.set(projectSyncActionsAtom, {
      flush: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      migrateLocalProjects: vi.fn(),
      remove,
    });
    const { result } = renderHook(useProjectTransition, { wrapper: makeWrapper(store) });
    act(() => result.current(action, "project"));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("project"));
    expect(action).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Could not delete project",
        message: "remote conflict",
        color: "red",
      }),
    );
  });

  it("deletes a guest project once before invoking the completion action", () => {
    const store = createTestStore();
    const project = newProjectRecord();
    store.set(workspaceAtom, { version: 1, activeProjectId: project.id, projects: [project] });
    const changed = vi.fn();
    const unsubscribe = store.sub(workspaceAtom, changed);
    const { result } = renderHook(useProjectTransition, { wrapper: makeWrapper(store) });
    const action = vi.fn(() => expect(store.get(workspaceAtom).projects).toHaveLength(0));
    act(() => result.current(action, project.id));
    expect(action).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
