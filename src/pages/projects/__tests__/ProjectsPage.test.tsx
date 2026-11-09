import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectAtom, importAsNewProjectAtom } from "@/state/actions";
import { projectNameAtom, workspaceAtom } from "@/state/atoms";
import { createTestStore, StoreWrapper } from "@/state/testing";
import { projectSyncActionsAtom } from "@/workspace/syncState";
import { deleteProject } from "@/workspace/workspace";
import ProjectsPage from "../ProjectsPage";

const navigate = vi.fn();
vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({ client: { signOut: vi.fn() }, user: null, isAuthenticated: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useLocation: ({ select }: { select?: (s: { pathname: string }) => unknown }) =>
    select ? select({ pathname: "/projects" }) : { pathname: "/projects" },
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

function renderPage() {
  const store = createTestStore();
  render(
    <MantineProvider>
      <StoreWrapper store={store}>
        <ProjectsPage />
      </StoreWrapper>
    </MantineProvider>,
  );
  return store;
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
  });

  it("lists projects and the New project button goes to the form", () => {
    const store = renderPage();
    act(() => {
      store.set(createProjectAtom);
    });
    expect(screen.getByRole("button", { name: "Open Unnamed Project" })).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "New project" }).click());
    expect(navigate).toHaveBeenCalledWith({ to: "/project" });
  });

  it("deleting a non-active project keeps the active one", async () => {
    const store = renderPage();
    act(() => {
      store.set(importAsNewProjectAtom, {
        project: { name: "Old trial" },
        experiments: [{ experiment_id: "E1" }, { experiment_id: "E2" }],
        datasets: [{ formData: { name: "DS" } }],
      });

      store.set(importAsNewProjectAtom, {
        project: { name: "Current trial" },
        experiments: [],
        datasets: [],
      });
    });
    expect(store.get(projectNameAtom)).toBe("Current trial");

    act(() => screen.getByRole("button", { name: "Delete Old trial" }).click());
    // Mantine's Modal mounts its content after a transition frame.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Delete Old trial and its 2 experiments and 1 dataset?");
    act(() => within(dialog).getByRole("button", { name: "Delete project" }).click());

    expect(screen.queryByRole("button", { name: "Open Old trial" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open Current trial" })).toBeInTheDocument();
    expect(store.get(projectNameAtom)).toBe("Current trial");
  });

  it("does not apply a second local deletion after cloud acknowledgement", async () => {
    const store = renderPage();
    act(() => store.set(createProjectAtom));
    const id = store.get(workspaceAtom).projects[0].id;
    const remove = vi.fn(async (projectId: string) => {
      store.set(workspaceAtom, (workspace) => deleteProject(workspace, projectId));
    });
    store.set(projectSyncActionsAtom, {
      flush: vi.fn(),
      migrateLocalProjects: vi.fn(),
      stop: vi.fn(),
      remove,
    });
    const changes = vi.fn();
    const unsubscribe = store.sub(workspaceAtom, changes);
    act(() => screen.getByRole("button", { name: "Delete Unnamed Project" }).click());
    const dialog = await screen.findByRole("dialog");
    act(() => within(dialog).getByRole("button", { name: "Delete project" }).click());
    await waitFor(() => expect(remove).toHaveBeenCalledWith(id));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(store.get(workspaceAtom).projects).toHaveLength(0);
    expect(changes).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
