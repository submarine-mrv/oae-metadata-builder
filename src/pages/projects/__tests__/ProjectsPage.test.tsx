import { MantineProvider } from "@mantine/core";
import { act, render, screen, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
import ProjectsPage from "../ProjectsPage";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useLocation: ({ select }: { select?: (s: { pathname: string }) => unknown }) =>
    select ? select({ pathname: "/projects" }) : { pathname: "/projects" },
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

function Seed() {
  const { createProject } = useWorkspace();
  return (
    <button type="button" onClick={() => createProject()}>
      seed
    </button>
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

  it("shows an empty state whose button creates a project", () => {
    renderPage();
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Create project" }).click());
    expect(navigate).toHaveBeenCalledWith({ to: "/project" });
  });

  it("returns to the empty state after the last project is deleted", async () => {
    renderPage();
    act(() => screen.getByText("seed").click());
    expect(screen.queryByText("No projects yet")).toBeNull();

    act(() => screen.getByRole("button", { name: "Delete Unnamed Project" }).click());
    // Mantine's Modal mounts its content after a transition frame.
    const dialog = await screen.findByRole("dialog");
    act(() => within(dialog).getByRole("button", { name: "Delete project" }).click());
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });
});
