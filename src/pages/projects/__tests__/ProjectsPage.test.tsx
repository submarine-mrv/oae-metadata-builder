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

  it("lists projects and the New project button goes to the form", () => {
    renderPage();
    act(() => screen.getByText("seed").click());
    expect(screen.getByRole("button", { name: "Open Unnamed Project" })).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "New project" }).click());
    expect(navigate).toHaveBeenCalledWith({ to: "/project" });
  });

  it("deleting the last project removes its card", async () => {
    renderPage();
    act(() => screen.getByText("seed").click());
    act(() => screen.getByRole("button", { name: "Delete Unnamed Project" }).click());
    // Mantine's Modal mounts its content after a transition frame.
    const dialog = await screen.findByRole("dialog");
    act(() => within(dialog).getByRole("button", { name: "Delete project" }).click());
    expect(screen.queryByRole("button", { name: /^Open / })).toBeNull();
  });
});
