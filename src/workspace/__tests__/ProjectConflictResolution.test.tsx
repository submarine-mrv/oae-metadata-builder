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

const mediaQueryMock = vi.hoisted(() => vi.fn(() => false));
vi.mock("@mantine/hooks", () => ({ useMediaQuery: mediaQueryMock }));

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

function setup(conflicts: SyncConflict[] = [nameConflict, variablesConflict], mobile = false) {
  mediaQueryMock.mockReturnValue(mobile);
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
const openConflict = (label: string) => {
  const nav = screen.queryByRole("navigation", { name: "Conflicting fields" });
  if (nav) fireEvent.click(within(nav).getByRole("button", { name: new RegExp(label) }));
};
const choice = (name: string) =>
  screen.getByRole("radiogroup", { name: `Version to keep for ${name}` });
const choose = (name: string, option: "Keep Local version" | "Use Cloud version") =>
  fireEvent.click(within(choice(name)).getByRole("radio", { name: option }));
const apply = () => screen.getByRole("button", { name: "Apply choices" });

describe("project conflict resolution", () => {
  it("shows each clash and saves an independent choice for each", async () => {
    const { actions, onClose } = setup();
    await screen.findAllByText("0 of 2 chosen");
    expect(within(card("Project: Project Name")).getByText("Mine")).toBeVisible();
    expect(within(card("Project: Project Name")).getByText("Theirs")).toBeVisible();
    expect(apply()).toBeDisabled();

    choose("Project: Project Name", "Keep Local version");
    expect(apply()).toBeDisabled();
    openConflict("Variables");
    choose('Dataset "Samples": Variables', "Use Cloud version");
    expect(screen.getAllByText("2 of 2 chosen")[0]).toBeVisible();
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
    await screen.findAllByText("0 of 2 chosen");
    openConflict("Variables");
    const variables = await screen.findByRole("region", { name: 'Dataset "Samples": Variables' });
    // Objects use the semantic diff even in Text view.
    expect(within(variables).getByText("/0/units")).toBeVisible();
    expect(within(variables).queryByText("/0/same")).toBeNull();

    openConflict("Project Name");
    choose("Project: Project Name", "Use Cloud version");
    fireEvent.click(screen.getByRole("radio", { name: "JSON diff" }));
    openConflict("Project Name");
    const name = card("Project: Project Name");
    expect(within(name).getByText("(whole value)")).toBeVisible();
    expect(
      within(choice("Project: Project Name")).getByRole("radio", { name: "Use Cloud version" }),
    ).toBeChecked();
  });

  it("asks for another look when the clashes changed, keeping still-valid choices", async () => {
    const { actions, onClose } = setup();
    await screen.findAllByText("0 of 2 chosen");
    choose("Project: Project Name", "Keep Local version");
    openConflict("Variables");
    choose('Dataset "Samples": Variables', "Keep Local version");
    const changed = { ...variablesConflict, remote: { present: true as const, value: [] } };
    actions.resolveProjectConflict.mockRejectedValueOnce(
      new ProjectConflictChangedError("one", [nameConflict, changed]),
    );
    fireEvent.click(apply());

    expect(await screen.findByText(/Changes updated while you were reviewing/)).toBeVisible();
    expect(screen.getAllByText("1 of 2 chosen")[0]).toBeVisible();
    openConflict("Project Name");
    expect(
      within(choice("Project: Project Name")).getByRole("radio", { name: "Keep Local version" }),
    ).toBeChecked();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("groups fields, steps with Next field and applies bulk choices from the header", async () => {
    setup();
    await screen.findAllByText("0 of 2 chosen");
    const nav = screen.getByRole("navigation", { name: "Conflicting fields" });
    expect(within(nav).getByText('Dataset "Samples"')).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next field" }));
    expect(card('Dataset "Samples": Variables')).toBeVisible();
    expect(screen.getByRole("button", { name: "Next field" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cloud for all" }));
    expect(screen.getAllByText("2 of 2 chosen")[0]).toBeVisible();
    expect(apply()).toBeEnabled();
  });

  it("stays open and shows why when saving fails", async () => {
    const { actions, onClose } = setup([nameConflict]);
    await screen.findByText("0 of 1 chosen");
    expect(screen.queryByRole("navigation", { name: "Conflicting fields" })).toBeNull();
    choose("Project: Project Name", "Use Cloud version");
    actions.resolveProjectConflict.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(apply());
    expect(await screen.findByText("offline")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses a full-screen one-field navigator on mobile", async () => {
    setup([nameConflict, variablesConflict], true);
    await screen.findByText("Field 1 of 2");
    expect(screen.queryByRole("navigation", { name: "Conflicting fields" })).toBeNull();
    expect(card("Project: Project Name")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous field" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next field" })).toBeVisible();
    choose("Project: Project Name", "Keep Local version");
    fireEvent.click(screen.getByRole("button", { name: "Next field" }));
    expect(await screen.findByText("Field 2 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Previous field" }));
    expect(await screen.findByText("Field 1 of 2")).toBeVisible();
    expect(
      within(choice("Project: Project Name")).getByRole("radio", { name: "Keep Local version" }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Next field" }));
    expect(await screen.findByText("Field 2 of 2")).toBeVisible();
    expect(card('Dataset "Samples": Variables')).toBeVisible();
    expect(screen.getByRole("radio", { name: "JSON diff" })).toBeVisible();
  });
});
