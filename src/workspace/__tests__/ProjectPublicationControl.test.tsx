import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { createTestStore } from "@/state/testing";
import ProjectPublicationControl from "../ProjectPublicationControl";
import { projectSyncActionsAtom } from "../syncState";
import { publicationProject } from "./publicationFixtures";

const mocks = vi.hoisted(() => ({
  enabled: true,
  provider: "supabase",
  user: { id: "owner" } as { id: string } | null,
  status: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/auth/config", () => ({
  get authEnabled() {
    return mocks.enabled;
  },
  get authProvider() {
    return mocks.provider;
  },
}));
vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, isAuthenticated: mocks.user !== null }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("../supabasePublicationClient", () => ({
  createPublicationClient: () => ({
    status: mocks.status,
    publish: mocks.publish,
    unpublish: mocks.unpublish,
  }),
}));

function setup(project = publicationProject(), flush = vi.fn().mockResolvedValue(undefined)) {
  const store = createTestStore({ version: 1, activeProjectId: project.id, projects: [project] });
  store.set(projectSyncActionsAtom, {
    flush,
    stop: vi.fn(),
    migrateLocalProjects: vi.fn(),
    remove: vi.fn(),
  });
  const view = render(
    <MantineProvider env="test">
      <Provider store={store}>
        <ProjectPublicationControl />
      </Provider>
    </MantineProvider>,
  );
  return { store, flush, ...view };
}

async function openReview() {
  fireEvent.click(screen.getByRole("button", { name: "Publication" }));
  await waitFor(() => expect(mocks.status).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Checking status")).not.toBeInTheDocument());
}

describe("explicit project publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.provider = "supabase";
    mocks.user = { id: "owner" };
    mocks.status.mockResolvedValue(null);
    mocks.publish.mockResolvedValue({
      projectId: "PUBLICATION-TEST",
      published: true,
      updatedAt: "2026-10-28T00:00:00Z",
    });
    mocks.unpublish.mockResolvedValue(undefined);
  });

  it.each(["guest", "disabled", "memory"])("makes no publication requests for %s", (mode) => {
    if (mode === "guest") mocks.user = null;
    if (mode === "disabled") mocks.enabled = false;
    if (mode === "memory") mocks.provider = "memory";
    setup();
    expect(screen.queryByRole("button", { name: "Publication" })).not.toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("requires review and saves the private draft before an explicit publish", async () => {
    const { flush } = setup();
    await openReview();
    expect(screen.getByText("This metadata will be public")).toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));
    await waitFor(() =>
      expect(mocks.publish).toHaveBeenCalledWith(
        "publication-draft",
        expect.objectContaining({ experiments: expect.any(Array), datasets: expect.any(Array) }),
      ),
    );
    expect(flush).toHaveBeenCalledOnce();
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.publish.mock.invocationCallOrder[0],
    );
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Project published",
        }),
      ),
    );
  });

  it("blocks invalid metadata but still allows an existing publication to be unpublished", async () => {
    mocks.status.mockResolvedValue({
      projectId: "PUBLICATION-TEST",
      published: true,
      updatedAt: "2026-10-28T00:00:00Z",
    });
    const project = publicationProject();
    project.state.projectData.name = "";
    setup(project);
    await openReview();
    expect(screen.getByText("Fix metadata before publishing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update publication" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Unpublish..." }));
    expect(mocks.unpublish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm unpublish" }));
    await waitFor(() => expect(mocks.unpublish).toHaveBeenCalledWith("publication-draft"));
  });

  it("does not publish when saving the private draft fails", async () => {
    setup(publicationProject(), vi.fn().mockRejectedValue(new Error("draft conflict")));
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));
    await screen.findByText("draft conflict");
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("can unpublish independently of failed private draft saves", async () => {
    mocks.status.mockResolvedValue({
      projectId: "PUBLICATION-TEST",
      published: true,
      updatedAt: "2026-10-28T00:00:00Z",
    });
    const { store, flush } = setup(
      publicationProject(),
      vi.fn().mockRejectedValue(new Error("unrelated draft conflict")),
    );
    const before = store.get(workspaceAtom);
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Unpublish..." }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unpublish" }));
    await waitFor(() => expect(mocks.unpublish).toHaveBeenCalledWith("publication-draft"));
    expect(flush).not.toHaveBeenCalled();
    expect(store.get(workspaceAtom)).toBe(before);
  });

  it("rejects changes introduced while the reviewed draft is being saved", async () => {
    let acknowledge!: () => void;
    const { store } = setup(
      publicationProject(),
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            acknowledge = resolve;
          }),
      ),
    );
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((project) => ({
          ...project,
          state: {
            ...project.state,
            projectData: { ...project.state.projectData, name: "New name" },
          },
        })),
      })),
    );
    await act(async () => acknowledge());
    await screen.findByText(
      "The project changed. Close this dialog and review the latest version.",
    );
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("surfaces publication failure without claiming success and allows retry", async () => {
    mocks.publish.mockRejectedValueOnce(new Error("publication failed"));
    setup();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));
    await screen.findByText("publication failed");
    expect(mocks.notify).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalled());
  });

  it("keeps status failures distinct from private status and retries them", async () => {
    mocks.status.mockRejectedValue(new Error("status offline"));
    setup();
    await openReview();
    await screen.findByText("status offline");
    expect(screen.getByRole("button", { name: "Publish project" })).toBeDisabled();
    mocks.status.mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: "Retry status" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Publish project" })).toBeEnabled(),
    );
  });
});
