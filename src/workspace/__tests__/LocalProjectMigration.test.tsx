import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportMetadata } from "@/utils/exportImport";
import { WORKSPACE_KEY } from "../storage";
import LocalProjectMigration from "../sync/LocalProjectMigration";
import { projectSyncActionsAtom } from "../syncState";
import { newProjectRecord } from "../types";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@/utils/exportImport", () => ({ exportMetadata: vi.fn() }));

describe("local project consent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  function setup(migrate = vi.fn().mockResolvedValue(undefined)) {
    const store = createStore();
    store.set(projectSyncActionsAtom, {
      flush: vi.fn(),
      refresh: vi.fn(),
      discardProjectChanges: vi.fn(),
      keepProjectChanges: vi.fn(),
      remove: vi.fn(),
      stop: vi.fn(),
      migrateLocalProjects: migrate,
    });
    render(
      <MantineProvider>
        <Provider store={store}>
          <LocalProjectMigration />
        </Provider>
      </MantineProvider>,
    );
    return migrate;
  }

  function seed() {
    const project = newProjectRecord();
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({ version: 1, activeProjectId: project.id, projects: [project] }),
    );
    return project;
  }

  it("does not prompt without local projects", () => {
    setup();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warns before discarding and removes only local copies without uploading", async () => {
    seed();
    localStorage.setItem("oae-auth", "untouched");
    const migrate = setup();
    expect(await screen.findByText(/permanently cleared/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear without importing" }));
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Local projects cleared" }),
      ),
    );
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects).toEqual([]);
    expect(localStorage.getItem("oae-auth")).toBe("untouched");
    expect(migrate).not.toHaveBeenCalled();
  });

  it("exports local projects before the user chooses whether to import or clear them", async () => {
    const project = seed();
    setup();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Export local projects" }));
    expect(exportMetadata).toHaveBeenCalledWith(
      project.state.projectData,
      project.state.experiments,
      project.state.datasets,
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(localStorage.getItem(WORKSPACE_KEY)).toContain(project.id);
  });

  it("imports only after consent and sends a success notification", async () => {
    seed();
    const migrate = setup();
    await screen.findByRole("dialog");
    expect(migrate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import local projects" }));
    await waitFor(() => expect(migrate).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Local projects imported", color: "green" }),
      ),
    );
  });

  it("keeps the prompt and source data on upload failure", async () => {
    seed();
    const before = localStorage.getItem(WORKSPACE_KEY);
    setup(vi.fn().mockRejectedValue(new Error("Upload unavailable")));
    fireEvent.click(await screen.findByRole("button", { name: "Import local projects" }));
    expect(await screen.findByText("Upload unavailable")).toBeVisible();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(before);
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("refuses to discard local data changed in another tab after consent is shown", async () => {
    const project = seed();
    setup();
    await screen.findByRole("dialog");
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({
        version: 1,
        activeProjectId: project.id,
        projects: [{ ...project, updatedAt: project.updatedAt + 1 }],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear without importing" }));
    expect(await screen.findByText(/changed during migration/)).toBeVisible();
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear without importing" }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects).toHaveLength(0),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("allows continuing without deleting local copies after a migration error", async () => {
    seed();
    const before = localStorage.getItem(WORKSPACE_KEY);
    setup(vi.fn().mockRejectedValue(new Error("Upload unavailable")));
    fireEvent.click(await screen.findByRole("button", { name: "Import local projects" }));
    await screen.findByText("Upload unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Keep local copies and continue" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(before);
  });
});
