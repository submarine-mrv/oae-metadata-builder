import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import ProjectConflictResolution from "../sync/ProjectConflictResolution";
import { type ProjectSyncActions, projectSyncActionsAtom } from "../syncState";
import { newProjectRecord } from "../types";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));

function setup() {
  const store = createStore();
  const project = { ...newProjectRecord(), id: "one" };
  store.set(workspaceAtom, { version: 1, activeProjectId: "one", projects: [project] });
  const actions = {
    flush: vi.fn(),
    stop: vi.fn(),
    migrateLocalProjects: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    keepProjectChanges: vi.fn().mockResolvedValue(undefined),
    discardProjectChanges: vi.fn().mockResolvedValue(undefined),
  } satisfies ProjectSyncActions;
  store.set(projectSyncActionsAtom, actions);
  const onClose = vi.fn();
  render(
    <MantineProvider>
      <Provider store={store}>
        <ProjectConflictResolution
          projectId="one"
          message="Conflicting changes"
          onClose={onClose}
        />
      </Provider>
    </MantineProvider>,
  );
  return { actions, onClose };
}

describe("project conflict resolution", () => {
  it("keeps this tab's version", async () => {
    const { actions, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.keepProjectChanges).toHaveBeenCalledWith("one");
  });

  it("takes the other version", async () => {
    const { actions, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Use the other version" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.discardProjectChanges).toHaveBeenCalledWith("one");
  });

  it("stays open and shows why when resolving fails", async () => {
    const { actions, onClose } = setup();
    actions.discardProjectChanges.mockRejectedValueOnce(new Error("changed again"));
    fireEvent.click(screen.getByRole("button", { name: "Use the other version" }));
    expect(await screen.findByText("changed again")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
