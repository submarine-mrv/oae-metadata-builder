import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { exportMetadata } from "@/utils/exportImport";
import ProjectConflictResolution from "../sync/ProjectConflictResolution";
import { projectSyncActionsAtom } from "../syncState";
import { newProjectRecord } from "../types";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@/utils/exportImport", () => ({ exportMetadata: vi.fn() }));

describe("explicit project conflict resolution", () => {
  beforeEach(() => vi.clearAllMocks());

  function setup() {
    const store = createStore();
    const project = newProjectRecord();
    const discard = vi.fn().mockResolvedValue(undefined);
    const keep = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    store.set(workspaceAtom, { version: 1, activeProjectId: project.id, projects: [project] });
    store.set(projectSyncActionsAtom, {
      flush: vi.fn(),
      refresh: vi.fn(),
      discardProjectChanges: discard,
      keepProjectChanges: keep,
      migrateLocalProjects: vi.fn(),
      remove: vi.fn(),
      stop: vi.fn(),
    });
    render(
      <MantineProvider>
        <Provider store={store}>
          <ProjectConflictResolution projectId={project.id} onClose={close} />
        </Provider>
      </MantineProvider>,
    );
    return { store, project, discard, keep, close };
  }

  it("warns before discarding and exports the latest unsaved project without changing it", async () => {
    const { store, project, discard, close } = setup();
    await screen.findByRole("dialog");
    expect(screen.getByText(/permanently replaces/)).toBeVisible();
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: [
          {
            ...project,
            state: {
              ...project.state,
              projectData: { name: "Latest draft" },
            },
          },
        ],
      })),
    );
    fireEvent.click(screen.getByRole("button", { name: "Export unsaved project" }));
    expect(exportMetadata).toHaveBeenCalledWith({ name: "Latest draft" }, [], []);
    expect(discard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    expect(discard).not.toHaveBeenCalled();
  });

  it("reports discard errors and closes only after a successful explicit retry", async () => {
    const { project, discard, close } = setup();
    discard.mockRejectedValueOnce(new Error("Cloud unavailable"));
    fireEvent.click(await screen.findByRole("button", { name: "Discard local changes" }));
    expect(await screen.findByText("Cloud unavailable")).toBeVisible();
    expect(discard).toHaveBeenCalledWith(project.id);
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard local changes" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Local changes discarded",
        color: "green",
      }),
    );
  });

  it("requires confirmation to keep the local version and surfaces a lost CAS race", async () => {
    const { keep, close } = setup();
    keep.mockRejectedValueOnce(new Error("The cloud project changed again."));
    fireEvent.click(await screen.findByRole("button", { name: "Keep my version" }));
    expect(keep).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm overwrite" }));
    expect(await screen.findByText("The cloud project changed again.")).toBeVisible();
    expect(keep).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });
});
