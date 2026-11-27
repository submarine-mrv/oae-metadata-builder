import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { createTestStore } from "@/state/testing";
import { buildMetadataDocument } from "@/utils/exportImport";
import ProjectPublicationControl from "../ProjectPublicationControl";
import type { ProjectRole } from "../projectCloudSync/types";
import { projectAccessAtom, projectSyncActionsAtom } from "../syncState";
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

function setup(
  project = publicationProject(),
  flush = vi.fn().mockResolvedValue(undefined),
  role: ProjectRole | null = "owner",
  acknowledgedHash = vi.fn((): string | null => "saved-hash"),
) {
  const store = createTestStore({ version: 1, activeProjectId: project.id, projects: [project] });
  if (role !== null) {
    store.set(projectAccessAtom, {
      [project.id]: {
        role,
        ownerEmail: "owner@example.com",
        updatedByEmail: null,
        memberCount: 0,
      },
    });
  }
  store.set(projectSyncActionsAtom, {
    flush,
    acknowledgedHash,
    refresh: vi.fn(),
    keepProjectChanges: vi.fn(),
    discardProjectChanges: vi.fn(),
    previewProjectConflict: vi.fn(),
    resolveProjectConflict: vi.fn(),
    stop: vi.fn(),
    migrateLocalProjects: vi.fn(),
    remove: vi.fn(),
  });
  const onPublishedChange = vi.fn();
  const view = render(
    <MantineProvider env="test">
      <Provider store={store}>
        <ProjectPublicationControl onPublishedChange={onPublishedChange} />
      </Provider>
    </MantineProvider>,
  );
  return { store, flush, acknowledgedHash, onPublishedChange, ...view };
}

async function openReview() {
  const button = screen.getByRole("button", { name: /^(Publish|Publish Updates)$/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(mocks.status).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Checking status")).not.toBeInTheDocument());
}

function publishedStatus(project = publicationProject()) {
  return {
    projectId: "PUBLICATION-TEST",
    published: true,
    updatedAt: "2026-10-28T00:00:00Z",
    versionNo: 1,
    document: buildMetadataDocument(
      project.state.projectData,
      project.state.experiments,
      project.state.datasets,
    ),
  };
}

describe("explicit project publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.provider = "supabase";
    mocks.user = { id: "owner" };
    mocks.status.mockResolvedValue(null);
    mocks.publish.mockResolvedValue(publishedStatus());
    mocks.unpublish.mockResolvedValue(undefined);
  });

  it.each(["guest", "disabled", "memory"])("makes no publication requests for %s", (mode) => {
    if (mode === "guest") mocks.user = null;
    if (mode === "disabled") mocks.enabled = false;
    if (mode === "memory") mocks.provider = "memory";
    setup();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it.each(["editor", "viewer"] as const)("does not expose publication to a %s", (role) => {
    setup(publicationProject(), undefined, role);
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("does not expose publication until cloud ownership is confirmed", () => {
    setup(publicationProject(), undefined, null);
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("requires review and saves the private draft before an explicit publish", async () => {
    const { flush, acknowledgedHash, onPublishedChange } = setup();
    expect(screen.getByRole("button", { name: "Publish" })).toHaveAttribute(
      "title",
      "Publish this project",
    );
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
    await openReview();
    expect(screen.getByText("This metadata will be public")).toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));
    await waitFor(() =>
      expect(mocks.publish).toHaveBeenCalledWith("publication-draft", "saved-hash"),
    );
    expect(flush).toHaveBeenCalledOnce();
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
      acknowledgedHash.mock.invocationCallOrder[0],
    );
    expect(acknowledgedHash).toHaveBeenCalledWith("publication-draft");
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Project published",
        }),
      ),
    );
    await screen.findByRole("button", { name: "Publish Updates" });
    expect(screen.getByRole("button", { name: "Publish Updates" })).toBeDisabled();
    await waitFor(() => expect(onPublishedChange).toHaveBeenLastCalledWith(true));
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("blocks publication when a required dataset field is empty", async () => {
    const project = publicationProject();
    project.state.datasets[0].formData.data_submitter = {
      ...project.state.datasets[0].formData.data_submitter,
      name: "",
    };
    setup(project);
    await openReview();
    expect(screen.getByText("Fix metadata before publishing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish project" })).toBeDisabled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("only enables updates for changed metadata and disables them again after publishing", async () => {
    const original = publicationProject();
    mocks.status.mockResolvedValue(publishedStatus(original));
    const { store } = setup(original);
    const button = await screen.findByRole("button", { name: "Publish Updates" });
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeEnabled();
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();

    const metadataUnchanged = structuredClone(original);
    metadataUnchanged.updatedAt++;
    metadataUnchanged.state.datasets[0].updatedAt++;
    metadataUnchanged.state.nextDatasetId++;
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: [metadataUnchanged],
      })),
    );
    expect(button).toBeDisabled();

    const edited = structuredClone(original);
    edited.state.datasets[0].formData.description = "Updated dataset metadata";
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: [edited],
      })),
    );
    expect(button).toBeEnabled();
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: [original],
      })),
    );
    expect(button).toBeDisabled();

    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: [edited],
      })),
    );
    mocks.publish.mockResolvedValue(publishedStatus(edited));
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Update publication" }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());
    await waitFor(() => expect(button).toBeDisabled());
  });

  it("blocks a redundant update when the refreshed publication already contains the reviewed edit", async () => {
    const original = publicationProject();
    const edited = structuredClone(original);
    edited.state.projectData.description = "Already published on another device";
    mocks.status
      .mockResolvedValueOnce(publishedStatus(original))
      .mockResolvedValue(publishedStatus(edited));
    setup(edited);
    await openReview();
    const confirm = screen.getByRole("button", { name: "Update publication" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("blocks invalid metadata but still allows an existing publication to be unpublished", async () => {
    mocks.status.mockResolvedValue(publishedStatus());
    const project = publicationProject();
    project.state.projectData.name = "";
    setup(project);
    await openReview();
    expect(screen.getByText("Fix metadata before publishing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update publication" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    await screen.findByText("Unpublish this project?");
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
    mocks.status.mockResolvedValue(publishedStatus());
    const { store, flush, onPublishedChange } = setup(
      publicationProject(),
      vi.fn().mockRejectedValue(new Error("unrelated draft conflict")),
    );
    const before = store.get(workspaceAtom);
    await screen.findByRole("button", { name: "Publish Updates" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    await screen.findByText("Unpublish this project?");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirm unpublish" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm unpublish" }));
    await waitFor(() => expect(mocks.unpublish).toHaveBeenCalledWith("publication-draft"));
    expect(flush).not.toHaveBeenCalled();
    expect(store.get(workspaceAtom)).toBe(before);
    await screen.findByRole("button", { name: "Publish" });
    await waitFor(() => expect(onPublishedChange).toHaveBeenLastCalledWith(false));
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
  });

  it("does not publish until the cloud has acknowledged the reviewed draft", async () => {
    setup(
      publicationProject(),
      undefined,
      "owner",
      vi.fn(() => null),
    );
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));
    await screen.findByText("The project hasn't finished saving. Retry in a moment.");
    expect(mocks.publish).not.toHaveBeenCalled();
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
