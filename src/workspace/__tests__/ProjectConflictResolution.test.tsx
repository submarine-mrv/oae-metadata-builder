import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import type { SyncConflict } from "../merge";
import ProjectConflictResolution from "../sync/ProjectConflictResolution";
import {
  ProjectConflictChangedError,
  type ProjectSyncActions,
  projectSyncActionsAtom,
} from "../syncState";
import { newProjectRecord } from "../types";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));

const nameConflict: SyncConflict = {
  key: "name",
  scope: "field",
  kind: "project",
  group: "Project",
  label: "Project Name",
  message: '"Project Name"',
  local: { present: true, value: "Mine" },
  remote: { present: true, value: "Theirs" },
};
const variablesConflict: SyncConflict = {
  key: "variables",
  scope: "field",
  kind: "dataset",
  entityId: "d",
  group: 'Dataset "Samples"',
  label: "Variables",
  message: '"Variables" in dataset "Samples"',
  local: { present: true, value: [{ name: "pH", units: "mol/kg", same: 1 }] },
  remote: { present: true, value: [{ same: 1, name: "pH", units: "mmol/kg" }] },
};

function setup(conflicts: SyncConflict[] = [nameConflict, variablesConflict]) {
  const store = createStore();
  const project = { ...newProjectRecord(), id: "one" };
  store.set(workspaceAtom, { version: 1, activeProjectId: "one", projects: [project] });
  const actions = {
    flush: vi.fn(),
    stop: vi.fn(),
    migrateLocalProjects: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    keepProjectChanges: vi.fn(),
    discardProjectChanges: vi.fn(),
    previewProjectConflict: vi.fn().mockResolvedValue(conflicts),
    resolveProjectConflict: vi.fn().mockResolvedValue(undefined),
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

const card = (name: string) => screen.getByRole("region", { name });
const choose = (name: string, option: "Keep mine" | "Use incoming") =>
  fireEvent.click(within(card(name)).getByRole("radio", { name: option }));
const apply = () => screen.getByRole("button", { name: "Apply choices" });

describe("project conflict resolution", () => {
  it("shows each clash and saves an independent choice for each", async () => {
    const { actions, onClose } = setup();
    await screen.findByText("0 of 2 resolved");
    expect(within(card("Project: Project Name")).getByText("Mine")).toBeVisible();
    expect(within(card("Project: Project Name")).getByText("Theirs")).toBeVisible();
    expect(apply()).toBeDisabled();

    choose("Project: Project Name", "Keep mine");
    expect(apply()).toBeDisabled();
    choose('Dataset "Samples": Variables', "Use incoming");
    expect(screen.getByText("2 of 2 resolved")).toBeVisible();
    fireEvent.click(apply());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.resolveProjectConflict).toHaveBeenCalledWith(
      "one",
      { name: "local", variables: "remote" },
      [nameConflict, variablesConflict],
    );
  });

  it("shows only the changed JSON paths, and keeps choices across views", async () => {
    setup();
    const variables = await screen.findByRole("region", { name: 'Dataset "Samples": Variables' });
    // Objects use the semantic diff even in Text view.
    expect(within(variables).getByText("/0/units")).toBeVisible();
    expect(within(variables).queryByText("/0/same")).toBeNull();

    choose("Project: Project Name", "Use incoming");
    fireEvent.click(screen.getByRole("radio", { name: "JSON diff" }));
    const name = card("Project: Project Name");
    expect(within(name).getByText("(whole value)")).toBeVisible();
    expect(within(name).getByRole("radio", { name: "Use incoming" })).toBeChecked();
  });

  it("asks for another look when the clashes changed, keeping still-valid choices", async () => {
    const { actions, onClose } = setup();
    await screen.findByText("0 of 2 resolved");
    choose("Project: Project Name", "Keep mine");
    choose('Dataset "Samples": Variables', "Keep mine");
    const changed = { ...variablesConflict, remote: { present: true as const, value: [] } };
    actions.resolveProjectConflict.mockRejectedValueOnce(
      new ProjectConflictChangedError("one", [nameConflict, changed]),
    );
    fireEvent.click(apply());

    expect(await screen.findByText(/Changes updated while you were reviewing/)).toBeVisible();
    expect(screen.getByText("1 of 2 resolved")).toBeVisible();
    expect(
      within(card("Project: Project Name")).getByRole("radio", { name: "Keep mine" }),
    ).toBeChecked();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open and shows why when saving fails", async () => {
    const { actions, onClose } = setup([nameConflict]);
    await screen.findByText("0 of 1 resolved");
    choose("Project: Project Name", "Use incoming");
    actions.resolveProjectConflict.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(apply());
    expect(await screen.findByText("offline")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
