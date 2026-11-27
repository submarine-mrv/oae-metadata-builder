import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectAtom, importAsNewProjectAtom } from "@/state/actions";
import { activeProjectIdAtom, projectNameAtom, workspaceAtom } from "@/state/atoms";
import { createTestStore, StoreWrapper } from "@/state/testing";
import { projectSyncActionsAtom } from "@/workspace/syncState";
import { deleteProject } from "@/workspace/workspace";
import ProjectsPage from "../ProjectsPage";

const navigate = vi.fn();
const publication = vi.hoisted(() => ({
  user: null as { id: string } | null,
  ids: vi.fn(),
}));
vi.mock("@/auth/config", () => ({ authEnabled: true, authProvider: "supabase" }));
vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({
    client: { signOut: vi.fn() },
    user: publication.user,
    isAuthenticated: publication.user !== null,
  }),
}));
vi.mock("@/workspace/supabasePublicationClient", () => ({
  createPublicationClient: () => ({ publishedProjectIds: publication.ids }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouter: () => ({ buildLocation: () => ({ href: "/" }) }),
  useLocation: ({ select }: { select?: (s: { pathname: string }) => unknown }) =>
    select ? select({ pathname: "/projects" }) : { pathname: "/projects" },
  useMatches: ({ select }: { select: (matches: { routeId: string }[]) => unknown }) => select([]),
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
    publication.user = null;
    publication.ids.mockReset();
    publication.ids.mockResolvedValue([]);
  });

  it("lists projects and the New project button goes to the form", () => {
    const store = renderPage();
    act(() => {
      store.set(createProjectAtom);
    });
    expect(screen.getByRole("button", { name: "Open Unnamed Project" })).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "New project" }).click());
    expect(navigate).toHaveBeenCalledWith({
      to: "/projects/$projectId/metadata",
      params: { projectId: store.get(activeProjectIdAtom) },
    });
    expect(publication.ids).not.toHaveBeenCalled();
  });

  it("badges only confirmed published projects", async () => {
    publication.user = { id: "owner" };
    const store = renderPage();
    act(() => {
      store.set(importAsNewProjectAtom, {
        project: { name: "Public trial" },
        experiments: [],
        datasets: [],
      });
      store.set(importAsNewProjectAtom, {
        project: { name: "Private trial" },
        experiments: [],
        datasets: [],
      });
    });
    const publicId = store
      .get(workspaceAtom)
      .projects.find((project) => project.state.projectData.name === "Public trial")?.id;
    publication.ids.mockResolvedValue([publicId]);
    await screen.findByText("Published");
    expect(screen.getAllByText("Published")).toHaveLength(1);
    const publicCard = screen
      .getByRole("button", { name: "Open Public trial" })
      .closest(".mantine-Card-root");
    expect(publicCard).toHaveTextContent("Published");
    expect(screen.getByRole("button", { name: "Delete Public trial" })).toBeDisabled();
    const privateCard = screen
      .getByRole("button", { name: "Open Private trial" })
      .closest(".mantine-Card-root");
    expect(privateCard).not.toHaveTextContent("Published");
    expect(screen.getByRole("button", { name: "Delete Private trial" })).toBeEnabled();
    expect(screen.queryByText("Private", { exact: true })).not.toBeInTheDocument();
  });

  it("reports publication status failures and retries without showing false badges", async () => {
    publication.user = { id: "owner" };
    publication.ids.mockRejectedValue(new Error("status offline"));
    const store = renderPage();
    act(() => store.set(createProjectAtom));
    await screen.findByText("status offline");
    expect(screen.getByRole("button", { name: "Delete Unnamed Project" })).toBeDisabled();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    publication.ids.mockResolvedValue([store.get(workspaceAtom).projects[0].id]);
    act(() => screen.getByRole("button", { name: "Retry status" }).click());
    await screen.findByText("Published");
    expect(screen.queryByText("status offline")).not.toBeInTheDocument();
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
      refresh: vi.fn(),
      acknowledgedHash: vi.fn(() => "hash"),
      keepProjectChanges: vi.fn(),
      discardProjectChanges: vi.fn(),
      previewProjectConflict: vi.fn(),
      resolveProjectConflict: vi.fn(),
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
