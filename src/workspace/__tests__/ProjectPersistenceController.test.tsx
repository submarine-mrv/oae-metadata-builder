import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { WORKSPACE_KEY } from "../storage";
import { projectSyncActionsAtom, projectSyncStatusAtom } from "../syncState";
import { emptyProjectState, newProjectRecord } from "../types";

const mocks = vi.hoisted(() => ({
  auth: { status: "authenticated", user: { id: "A" } as { id: string } | null },
  enabled: true,
  provider: "supabase",
  load: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/auth/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/auth/config", () => ({
  get authEnabled() {
    return mocks.enabled;
  },
  get authProvider() {
    return mocks.provider;
  },
}));
vi.mock("@/auth/providers/supabase/projectClient", () => ({
  createProjectCloudClient: (id: string) => {
    mocks.create(id);
    return { load: mocks.load, save: mocks.save, remove: mocks.remove };
  },
}));
vi.mock("@/components/RestorePrompt", () => ({
  default: () => <div>Guest restore prompt</div>,
}));

import ProjectPersistenceController from "../ProjectPersistenceController";

function named(id: string) {
  return {
    ...newProjectRecord({ ...emptyProjectState(), projectData: { project_id: id, name: id } }),
    id,
  };
}

describe("auth-aware project persistence", () => {
  it("keeps earlier recovery snapshots when the same account is interrupted again", async () => {
    const { store, update } = setup();
    await screen.findByText("Editor");
    const interrupt = async (id: string) => {
      act(() => {
        store.set(workspaceAtom, (workspace) => ({
          ...workspace,
          projects: [...workspace.projects, named(id)],
        }));
      });
      mocks.auth = { status: "unauthenticated", user: null };
      update();
      await screen.findByText("Guest restore prompt");
      mocks.auth = { status: "authenticated", user: { id: "A" } };
      update();
      await screen.findByRole("button", { name: "Recover unsaved projects" });
    };
    await interrupt("first-unsaved");
    await interrupt("second-unsaved");
    fireEvent.click(screen.getByRole("button", { name: "Recover unsaved projects" }));
    await waitFor(() =>
      expect(store.get(workspaceAtom).projects.map((p) => p.id)).toEqual([
        "cloud-A",
        "first-unsaved",
        "second-unsaved",
      ]),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Recover unsaved projects" }),
      ).not.toBeInTheDocument(),
    );
  });
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.enabled = true;
    mocks.provider = "supabase";
    mocks.auth = { status: "authenticated", user: { id: "A" } };
    mocks.load.mockResolvedValue([{ project: named("cloud-A"), hash: "A" }]);
    mocks.save.mockImplementation(async (project, hash) => ({ saved: true, project, hash }));
  });
  afterEach(() => vi.restoreAllMocks());

  function setup() {
    const store = createStore();
    const content = () => (
      <MantineProvider>
        <Provider store={store}>
          <ProjectPersistenceController>
            <div>Editor</div>
          </ProjectPersistenceController>
        </Provider>
      </MantineProvider>
    );
    const result = render(content());
    return { ...result, store, update: () => result.rerender(content()) };
  }

  it("loads cloud projects without reading or overwriting local project storage", async () => {
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({
        version: 1,
        activeProjectId: "guest",
        projects: [named("guest")],
      }),
    );
    const previous = localStorage.getItem(WORKSPACE_KEY);
    const { store } = setup();
    await screen.findByText("Editor");
    expect(store.get(workspaceAtom).projects.map((p) => p.id)).toEqual(["cloud-A"]);
    expect(screen.queryByText("Guest restore prompt")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Import local projects" })).toBeVisible();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(previous);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("keeps authenticated edits out of localStorage including page-hide events", async () => {
    const { store } = setup();
    await screen.findByText("Editor");
    act(() => {
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((p) => ({ ...p, updatedAt: p.updatedAt + 1 })),
      }));
      window.dispatchEvent(new Event("pagehide"));
    });
    await act(async () => {
      await store.get(projectSyncActionsAtom)?.flush();
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  });

  it("clears the previous account before showing another account's projects", async () => {
    const { store, update } = setup();
    await screen.findByText("Editor");
    mocks.load.mockResolvedValue([{ project: named("cloud-B"), hash: "B" }]);
    mocks.auth = { status: "authenticated", user: { id: "B" } };
    update();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith("B"));
    await waitFor(() =>
      expect(store.get(workspaceAtom).projects.map((p) => p.id)).toEqual(["cloud-B"]),
    );
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  });

  it("restores guest data on logout without persisting cloud drafts into it", async () => {
    const guest = { version: 1, activeProjectId: "guest", projects: [named("guest")] };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(guest));
    const { store, update } = setup();
    await screen.findByText("Editor");
    mocks.auth = { status: "unauthenticated", user: null };
    update();
    await screen.findByText("Guest restore prompt");
    expect(store.get(workspaceAtom).projects.map((p) => p.id)).toEqual(["guest"]);
    expect(
      JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "").projects.map(
        (p: { id: string }) => p.id,
      ),
    ).toEqual(["guest"]);
  });

  it("preserves ordinary guest persistence with auth disabled", async () => {
    mocks.enabled = false;
    const { store } = setup();
    await screen.findByText("Guest restore prompt");
    act(() => {
      store.set(workspaceAtom, {
        version: 1,
        activeProjectId: "guest",
        projects: [named("guest")],
      });
    });
    expect(localStorage.getItem(WORKSPACE_KEY)).toContain("guest");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("preserves memory-provider auth flows without attempting Supabase draft persistence", async () => {
    mocks.provider = "memory";
    const { store, update } = setup();
    await screen.findByText("Editor");
    act(() => {
      store.set(workspaceAtom, {
        version: 1,
        activeProjectId: "demo",
        projects: [named("demo")],
      });
    });
    mocks.auth = { status: "unauthenticated", user: null };
    update();
    await screen.findByText("Editor");
    expect(store.get(workspaceAtom).projects.map((p) => p.id)).toEqual(["demo"]);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not hydrate or persist local projects while auth is loading", () => {
    mocks.auth = { status: "loading", user: null };
    const { store } = setup();
    expect(store.get(workspaceAtom).projects).toEqual([]);
    expect(screen.queryByText("Editor")).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps failed cloud loads gated and supports retry", async () => {
    mocks.load.mockRejectedValueOnce(new Error("load unavailable"));
    setup();
    await screen.findByText("load unavailable");
    expect(screen.queryByText("Editor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading projects" }));
    await screen.findByText("Editor");
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it("retains pending edits across external sign-out and recovers only for the original account", async () => {
    const { store, update } = setup();
    await screen.findByText("Editor");
    act(() => {
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((project) => ({
          ...project,
          updatedAt: project.updatedAt + 1,
          state: {
            ...project.state,
            projectData: { ...project.state.projectData, name: "unsaved-A" },
          },
        })),
      }));
    });

    mocks.auth = { status: "unauthenticated", user: null };
    update();
    await screen.findByText("Guest restore prompt");
    expect(screen.getByText("An account change interrupted unsaved project edits")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Recover unsaved projects" }),
    ).not.toBeInTheDocument();
    expect(store.get(workspaceAtom).projects).toEqual([]);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    mocks.auth = { status: "authenticated", user: { id: "A" } };
    update();
    const recover = await screen.findByRole("button", { name: "Recover unsaved projects" });
    fireEvent.click(recover);
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(store.get(workspaceAtom).projects[0].state.projectData.name).toBe("unsaved-A");
    await waitFor(() =>
      expect(
        screen.queryByText("An account change interrupted unsaved project edits"),
      ).not.toBeInTheDocument(),
    );
  });

  it("consumes recovered snapshots once even when their first cloud save fails", async () => {
    const { store, update } = setup();
    await screen.findByText("Editor");
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: [
          ...workspace.projects.map((project) => ({
            ...project,
            state: {
              ...project.state,
              datasets: [
                {
                  id: 1,
                  name: "Recovered dataset",
                  formData: { name: "Recovered dataset" },
                  createdAt: 1,
                  updatedAt: 1,
                  linking: { linkedExperimentInternalId: null },
                },
              ],
              nextDatasetId: 2,
            },
          })),
          named("unsaved"),
        ],
      })),
    );
    mocks.auth = { status: "unauthenticated", user: null };
    update();
    await screen.findByText("Guest restore prompt");
    mocks.auth = { status: "authenticated", user: { id: "A" } };
    update();
    const recover = await screen.findByRole("button", { name: "Recover unsaved projects" });
    mocks.save.mockRejectedValueOnce(new Error("Save unavailable"));
    fireEvent.click(recover);
    fireEvent.click(recover);
    await waitFor(() =>
      expect(store.get(projectSyncStatusAtom)).toMatchObject({
        state: "error",
        message: "Save unavailable",
      }),
    );
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual([
      "cloud-A",
      "unsaved",
    ]);
    expect(
      screen.queryByRole("button", { name: "Recover unsaved projects" }),
    ).not.toBeInTheDocument();
    expect(store.get(workspaceAtom).projects[0].state.datasets).toHaveLength(1);
    await act(async () => {
      await store.get(projectSyncActionsAtom)?.flush();
    });
    expect(store.get(workspaceAtom).projects.map((record) => record.id)).toEqual([
      "cloud-A",
      "unsaved",
    ]);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    expect(store.get(workspaceAtom).projects[0].state.datasets).toHaveLength(1);
  });
});
