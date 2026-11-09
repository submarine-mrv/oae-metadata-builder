import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import type { ProjectAccess } from "../projectCloudSync";
import ProjectConflictResolution from "../sync/ProjectConflictResolution";
import { type ProjectSyncActions, projectAccessAtom, projectSyncActionsAtom } from "../syncState";
import { newProjectRecord } from "../types";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));

function setup(access?: ProjectAccess) {
  const store = createStore();
  const project = { ...newProjectRecord(), id: "one" };
  store.set(workspaceAtom, { version: 1, activeProjectId: "one", projects: [project] });
  if (access) store.set(projectAccessAtom, { one: access });
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
          message="Newer changes also edited"
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
    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.keepProjectChanges).toHaveBeenCalledWith("one");
  });

  it("takes the other version", async () => {
    const { actions, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Use newer changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.discardProjectChanges).toHaveBeenCalledWith("one");
  });

  it("stays open and shows why when resolving fails", async () => {
    const { actions, onClose } = setup();
    actions.discardProjectChanges.mockRejectedValueOnce(new Error("changed again"));
    fireEvent.click(screen.getByRole("button", { name: "Use newer changes" }));
    expect(await screen.findByText("changed again")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("names who saved the newer changes on a shared project", () => {
    setup({
      role: "editor",
      ownerEmail: "o@example.com",
      updatedByEmail: "bob@example.com",
      memberCount: 1,
    });
    expect(screen.getByText("The newer changes were saved by bob@example.com.")).toBeVisible();
  });
});
