import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AmbiguousIdPage from "@/pages/not-found/AmbiguousIdPage";
import NotFoundPage from "@/pages/not-found/NotFoundPage";
import { createTestStore, StoreWrapper, workspaceWithProject } from "@/state/testing";
import type { ProjectRole } from "@/workspace/projectCloudSync";
import { projectAccessAtom, projectSyncActionsAtom } from "@/workspace/syncState";
import { emptyProjectState } from "@/workspace/types";
import OverviewPage from "../OverviewPage";

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  copy: vi.fn(),
  navigate: vi.fn(),
  members: {
    list: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, client: { signOut: vi.fn() } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/overview">{children}</a>,
  useLocation: ({ select }: { select: (location: { pathname: string }) => string }) =>
    select({ pathname: "/projects/KIEL" }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/workspace/useEntityNavigate", () => ({
  useCurrentEntityPage: () => "overview",
  useEntityNavigate: () => mocks.navigate,
}));
vi.mock("@/workspace/useCopyLink", () => ({ useCopyLink: () => mocks.copy }));
vi.mock("@/auth/providers/supabase/projectClient", () => ({
  createProjectMembersClient: () => mocks.members,
}));
vi.mock("@/workspace/ProjectPublicationControl", () => ({ default: () => null }));

function renderPage(role: ProjectRole | null, cloud = role !== null, page?: React.ReactNode) {
  const workspace = workspaceWithProject({
    ...emptyProjectState(),
    projectData: { name: "Kiel trial", project_id: "KIEL" },
  });
  const projectId = workspace.projects[0].id;
  const store = createTestStore(workspace);
  if (role) {
    store.set(projectAccessAtom, {
      [projectId]: {
        role,
        ownerEmail: "owner@example.test",
        updatedByEmail: null,
        memberCount: 1,
      },
    });
  }
  if (cloud) {
    store.set(projectSyncActionsAtom, {
      flush: vi.fn(),
      migrateLocalProjects: vi.fn(),
      remove: vi.fn(),
      refresh: vi.fn(),
      keepProjectChanges: vi.fn(),
      discardProjectChanges: vi.fn(),
      stop: vi.fn(),
    });
  }
  const element = () => (
    <MantineProvider>
      <StoreWrapper store={store}>{page ?? <OverviewPage />}</StoreWrapper>
    </MantineProvider>
  );
  return { ...render(element()), element, projectId, store };
}

describe("sharing visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    mocks.members.list.mockResolvedValue([{ email: "owner@example.test", role: "owner" }]);
  });

  it("hides sharing controls from signed-out users even if cloud state has not cleared yet", async () => {
    renderPage("owner");

    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await screen.findByRole("menuitem", { name: "How-to Guide" });
    expect(
      screen.queryByRole("menuitem", { name: "Copy link to this page", hidden: true }),
    ).not.toBeInTheDocument();
  });

  it("lets a signed-in owner copy links and closes sharing on sign-out", async () => {
    mocks.user = { id: "owner", email: "owner@example.test" };
    const { element, projectId, rerender } = renderPage("owner");

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy link to this page" }));
    expect(mocks.copy).toHaveBeenCalledWith("overview", projectId, undefined);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("dialog", { name: "Share project" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(mocks.copy).toHaveBeenCalledWith("overview", projectId);

    mocks.user = null;
    rerender(element());
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Share project" })).not.toBeInTheDocument();
  });

  it.each([
    "editor",
    "viewer",
  ] as const)("lets a signed-in %s copy a shared project link", async (role) => {
    mocks.user = { id: "member", email: "member@example.test" };
    const { projectId } = renderPage(role);

    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(
      await screen.findByRole("dialog", { name: "People on this project" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(mocks.copy).toHaveBeenCalledWith("overview", projectId);
  });

  it.each([
    ["browser-only storage", false],
    ["a cloud project not yet saved", true],
  ] as const)("does not offer sharing for %s", async (_, cloud) => {
    mocks.user = { id: "member", email: "member@example.test" };
    renderPage(null, cloud);

    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await screen.findByRole("menuitem", { name: "How-to Guide" });
    expect(
      screen.queryByRole("menuitem", { name: "Copy link to this page", hidden: true }),
    ).not.toBeInTheDocument();
  });

  it("offers sharing once a new project is saved to the cloud", async () => {
    mocks.user = { id: "owner", email: "owner@example.test" };
    const { projectId, store } = renderPage(null, true);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await screen.findByRole("menuitem", { name: "How-to Guide" });
    expect(
      screen.queryByRole("menuitem", { name: "Copy link to this page", hidden: true }),
    ).not.toBeInTheDocument();
    act(() => {
      store.set(projectAccessAtom, {
        [projectId]: {
          role: "owner",
          ownerEmail: "owner@example.test",
          updatedByEmail: null,
          memberCount: 0,
        },
      });
    });

    expect(
      screen.getByRole("menuitem", { name: "Copy link to this page", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
  });

  it.each([
    [
      "an unknown experiment",
      () => <NotFoundPage entity="Experiment" id="GONE" projectSlug="KIEL" />,
    ],
    [
      "an ambiguous project",
      () => (
        <AmbiguousIdPage
          entity="Project"
          id="KIEL"
          matches={[
            { id: "p1", name: "First" },
            { id: "p2", name: "Second" },
          ]}
          onChoose={vi.fn()}
        />
      ),
    ],
  ] as const)("does not offer a stale active-project link on %s", async (_, page) => {
    mocks.user = { id: "owner", email: "owner@example.test" };
    renderPage("owner", true, page());

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await screen.findByRole("menuitem", { name: "How-to Guide" });
    expect(
      screen.queryByRole("menuitem", { name: "Copy link to this page", hidden: true }),
    ).not.toBeInTheDocument();
  });
});
