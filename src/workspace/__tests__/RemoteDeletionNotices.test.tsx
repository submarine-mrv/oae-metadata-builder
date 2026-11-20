import { notifications } from "@mantine/notifications";
import { act, render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeExperimentIdAtom, workspaceAtom } from "@/state/atoms";
import RemoteDeletionNotices, { remoteDeletionMessage } from "../sync/RemoteDeletionNotices";
import { remoteDeletionsAtom } from "../syncState";
import { emptyProjectState, newProjectRecord } from "../types";

const router = vi.hoisted(() => ({ pathname: "/overview", navigate: vi.fn() }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useLocation: () => ({ pathname: router.pathname }),
}));

describe("remote deletion notices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.pathname = "/overview";
  });

  function setup() {
    const store = createStore();
    const experiment = (id: string) => ({
      id,
      name: `E${id}`,
      formData: { experiment_id: `E${id}` },
      createdAt: 1,
      updatedAt: 1,
    });
    const project = {
      ...newProjectRecord(
        {
          ...emptyProjectState(),
          experiments: [experiment("1"), experiment("2")],
        },
        1,
      ),
      id: "p",
    };
    store.set(workspaceAtom, { version: 1, activeProjectId: "p", projects: [project] });
    render(
      <Provider store={store}>
        <RemoteDeletionNotices />
      </Provider>,
    );
    return store;
  }

  it("words one deletion, several, and lost edits", () => {
    expect(remoteDeletionMessage([{ type: "experiment", name: "Site A" }])).toBe(
      'Experiment "Site A" was deleted in another tab or on another device.',
    );
    expect(remoteDeletionMessage([{ type: "project", name: "Plain" }])).toBe(
      'Project "Plain" was deleted in another tab or on another device.',
    );
    expect(remoteDeletionMessage([{ type: "project", name: "Shared", unsavedEdits: true }])).toBe(
      'Project "Shared" was deleted in another tab or on another device. Your recent edits to it weren\'t saved.',
    );
    expect(
      remoteDeletionMessage([
        { type: "experiment", name: "Site A", unsavedEdits: true },
        { type: "dataset", name: "CTD casts" },
      ]),
    ).toBe(
      'Experiment "Site A", dataset "CTD casts" were deleted in another tab or on another device. Your recent edits to experiment "Site A" weren\'t saved.',
    );
  });

  it("says when a project is no longer shared rather than deleted", () => {
    expect(
      remoteDeletionMessage([
        { type: "project", name: "Shared", projectId: "p", reason: "access" },
      ]),
    ).toBe('Project "Shared" is no longer shared with you.');
  });

  it("says when lost access or a downgrade discarded unsaved edits", () => {
    expect(
      remoteDeletionMessage([
        { type: "project", name: "Shared", projectId: "p", reason: "access", unsavedEdits: true },
      ]),
    ).toBe('Project "Shared" is no longer shared with you. Your recent edits weren\'t saved.');
    expect(
      remoteDeletionMessage([
        { type: "project", name: "Shared", projectId: "p", reason: "viewOnly", unsavedEdits: true },
      ]),
    ).toBe('You can now only view "Shared". Your unsaved changes there were discarded.');
  });

  it("stays on the project after a downgrade to viewer", () => {
    router.pathname = "/project";
    const store = setup();
    act(() =>
      store.set(remoteDeletionsAtom, [
        { type: "project", name: "P", projectId: "p", reason: "viewOnly", unsavedEdits: true },
      ]),
    );
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "View only" }),
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("shows one notice per batch and clears it", () => {
    const store = setup();
    expect(notifications.show).not.toHaveBeenCalled();
    act(() =>
      store.set(remoteDeletionsAtom, [
        { type: "experiment", name: "Site A" },
        { type: "dataset", name: "CTD casts" },
      ]),
    );
    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Deleted", color: "yellow" }),
    );
    expect(store.get(remoteDeletionsAtom)).toEqual([]);
  });

  it("leaves the page of the open experiment when it is deleted, and stays otherwise", () => {
    router.pathname = "/experiment";
    const store = setup();
    act(() => store.set(activeExperimentIdAtom, "2"));
    act(() =>
      store.set(remoteDeletionsAtom, [{ type: "experiment", name: "E1", projectId: "p", id: "1" }]),
    );
    expect(router.navigate).not.toHaveBeenCalled();
    act(() =>
      store.set(remoteDeletionsAtom, [{ type: "experiment", name: "E2", projectId: "p", id: "2" }]),
    );
    expect(router.navigate).toHaveBeenCalledWith({ to: "/overview" });
  });

  it("goes to All projects when the open project is deleted", () => {
    router.pathname = "/project";
    const store = setup();
    act(() => store.set(remoteDeletionsAtom, [{ type: "project", name: "P", projectId: "p" }]));
    expect(router.navigate).toHaveBeenCalledWith({ to: "/projects" });
  });
});
