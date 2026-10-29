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

  it("waits for cloud acknowledgement before changing projects", async () => {
    const store = createTestStore();
    let acknowledge!: () => void;
    const flush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    store.set(projectSyncActionsAtom, {
      flush,
      refresh: vi.fn(),
      discardProjectChanges: vi.fn(),
      stop: vi.fn(),
      migrateLocalProjects: vi.fn(),
      remove: vi.fn(),
    });
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition, { wrapper: makeWrapper(store) });
    act(() => result.current(action));
    expect(action).not.toHaveBeenCalled();
    await act(async () => acknowledge());
    expect(action).toHaveBeenCalledOnce();
  });

  it("retains the project and reports a failed save rather than navigating", async () => {
    const store = createTestStore();
    store.set(projectSyncActionsAtom, {
      flush: vi.fn().mockRejectedValue(new Error("not saved")),
      refresh: vi.fn(),
      discardProjectChanges: vi.fn(),
      stop: vi.fn(),
      migrateLocalProjects: vi.fn(),
      remove: vi.fn(),
    });
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition, { wrapper: makeWrapper(store) });
    act(() => result.current(action));
    await waitFor(() =>
      expect(store.get(projectSyncStatusAtom)).toEqual({
        state: "error",
        message: "not saved",
      }),
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("awaits conditional deletion before removing a project from Jotai", async () => {
    const store = createTestStore();
    const action = vi.fn();
    const remove = vi.fn().mockRejectedValue(new Error("remote conflict"));
    store.set(projectSyncActionsAtom, {
      flush: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn(),
      discardProjectChanges: vi.fn(),
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
