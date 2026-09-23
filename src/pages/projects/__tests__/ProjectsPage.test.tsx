import { MantineProvider } from "@mantine/core";
import { act, render, screen, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectAtom, importAsNewProjectAtom } from "@/state/actions";
import { projectNameAtom } from "@/state/atoms";
import { createTestStore, StoreWrapper } from "@/state/testing";
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
        project: { research_project: "Old trial" },
        experiments: [{ experiment_id: "E1" }, { experiment_id: "E2" }],
        datasets: [{ formData: { name: "DS" } }],
      });
      store.set(importAsNewProjectAtom, {
        project: { research_project: "Current trial" },
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
});
