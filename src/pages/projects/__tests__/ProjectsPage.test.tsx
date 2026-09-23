import { MantineProvider } from "@mantine/core";
import { act, render, screen, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
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

function Seed() {
  const { createProject, importAsNewProject, projects } = useWorkspace();
  const seedTwo = () => {
    importAsNewProject({
      project: { research_project: "Old trial" },
      experiments: [{ experiment_id: "E1" }, { experiment_id: "E2" }],
      datasets: [{ formData: { name: "DS" } }],
    });
    importAsNewProject({
      project: { research_project: "Current trial" },
      experiments: [],
      datasets: [],
    });
  };
  return (
    <>
      <button type="button" onClick={() => createProject()}>
        seed
      </button>
      <button type="button" onClick={seedTwo}>
        seed two
      </button>
      <span data-testid="active">{projects.find((p) => p.isActive)?.name}</span>
    </>
  );
}

function renderPage() {
  return render(
    <MantineProvider>
      <WorkspaceProvider>
        <AppStateProvider>
          <Seed />
          <ProjectsPage />
        </AppStateProvider>
      </WorkspaceProvider>
    </MantineProvider>,
  );
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
  });

  it("lists projects and the New project button goes to the form", () => {
    renderPage();
    act(() => screen.getByText("seed").click());
    expect(screen.getByRole("button", { name: "Open Unnamed Project" })).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "New project" }).click());
    expect(navigate).toHaveBeenCalledWith({ to: "/project" });
  });

  it("deleting a non-active project keeps the active one", async () => {
    renderPage();
    act(() => screen.getByText("seed two").click());
    expect(screen.getByTestId("active")).toHaveTextContent("Current trial");

    act(() => screen.getByRole("button", { name: "Delete Old trial" }).click());
    // Mantine's Modal mounts its content after a transition frame.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Delete Old trial and its 2 experiments and 1 dataset?");
    act(() => within(dialog).getByRole("button", { name: "Delete project" }).click());

    expect(screen.queryByRole("button", { name: "Open Old trial" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open Current trial" })).toBeInTheDocument();
    expect(screen.getByTestId("active")).toHaveTextContent("Current trial");
  });
});
