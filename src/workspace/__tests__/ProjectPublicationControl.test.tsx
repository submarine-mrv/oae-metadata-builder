import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import type { ProjectRecord } from "../types";
import { newProjectRecord } from "../types";

const { useAuthMock, publicationMocks } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  publicationMocks: {
    loadProjectPublicationStatus: vi.fn(),
    publishProject: vi.fn(),
    unpublishProject: vi.fn(),
  },
}));

vi.mock("@/auth/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("../supabasePublicationClient", () => publicationMocks);

import ProjectPublicationControl from "../ProjectPublicationControl";

const project = (): ProjectRecord =>
  newProjectRecord({
    projectData: {
      project_id: "PUBLISH-1",
      research_project: "Publication test",
      description: "A complete project",
      mcdr_pathway: "ocean_alkalinity_enhancement",
      spatial_coverage: { geo: { box: "-124 47 -122 48" } },
      temporal_coverage: "2024-01-01/2024-12-31",
      project_leads: [],
      sea_names: [],
    },
    experiments: [
      {
        id: 1,
        name: "Baseline",
        createdAt: 1,
        updatedAt: 2,
        formData: {
          project_id: "PUBLISH-1",
          experiment_id: "PUBLISH-1-EXP-1",
          name: "Baseline",
          description: "Baseline measurements",
          experiment_types: ["baseline"],
          spatial_coverage: { geo: { box: "-124 47 -122 48" } },
          experiment_leads: [],
          start_datetime: "2024-01-01T00:00:00Z",
        },
      },
    ],
    datasets: [
      {
        id: 1,
        name: "Water samples",
        createdAt: 1,
        updatedAt: 2,
        linking: { linkedExperimentInternalId: 1 },
        formData: {
          project_id: "PUBLISH-1",
          experiment_id: "PUBLISH-1-EXP-1",
          name: "Water samples",
          description: "Water sample dataset",
          temporal_coverage: "2024-01-01/2024-12-31",
          dataset_type: "bottle",
          data_product_type: "originally_collected_dataset",
          platform_info: {
            platform_type: "http://vocab.nerc.ac.uk/collection/L06/current/62/",
          },
          data_submitter: { name: "Researcher", role: "PI", email: "researcher@example.org" },
          filenames: ["samples.csv"],
          data_accessibility: "open_access",
          data_access_link: "https://doi.org/10.1234/example",
        },
      },
    ],
    nextExperimentId: 2,
    nextDatasetId: 2,
  });

function renderControl(record: ProjectRecord) {
  const store = createStore();
  store.set(workspaceAtom, {
    version: 1,
    activeProjectId: record.id,
    projects: [record],
  });
  return render(
    <MantineProvider>
      <Provider store={store}>
        <ProjectPublicationControl />
      </Provider>
    </MantineProvider>,
  );
}

describe("ProjectPublicationControl", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_AUTH_ENABLED", "true");
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    publicationMocks.loadProjectPublicationStatus.mockResolvedValue({
      published: false,
      publishedAt: null,
    });
    publicationMocks.publishProject.mockResolvedValue({
      published: true,
      publishedAt: "2026-01-01T00:00:00Z",
    });
    publicationMocks.unpublishProject.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("opens a publication confirmation for a valid complete project", async () => {
    renderControl(project());

    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Publish project");
    expect(screen.getByText("1 experiment")).toBeInTheDocument();
    expect(screen.getByText("1 dataset")).toBeInTheDocument();
  });

  it("confirms unpublishing through the publication client", async () => {
    publicationMocks.loadProjectPublicationStatus.mockResolvedValue({
      published: true,
      publishedAt: "2026-01-01T00:00:00Z",
    });
    renderControl(project());

    await userEvent.click(await screen.findByRole("button", { name: "Unpublish" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Unpublish project" }));

    await waitFor(() =>
      expect(publicationMocks.unpublishProject).toHaveBeenCalledWith("PUBLISH-1"),
    );
  });

  it("does not load publication status when auth is disabled", () => {
    vi.stubEnv("VITE_AUTH_ENABLED", "false");
    renderControl(project());

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(publicationMocks.loadProjectPublicationStatus).not.toHaveBeenCalled();
  });

  it("does not load publication status for guests", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false });
    renderControl(project());

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(publicationMocks.loadProjectPublicationStatus).not.toHaveBeenCalled();
  });

  it("blocks publishing and displays publication status failures", async () => {
    publicationMocks.loadProjectPublicationStatus.mockRejectedValueOnce(
      new Error("Could not load publication status"),
    );
    renderControl(project());

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load publication status");
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload" })).toBeEnabled();
    expect(publicationMocks.publishProject).not.toHaveBeenCalled();
  });

  it("retains the confirmation and displays a failed publication for retry", async () => {
    publicationMocks.publishProject.mockRejectedValueOnce(new Error("Publication unavailable"));
    const record = project();
    renderControl(record);

    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish project" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Publication unavailable");
    expect(publicationMocks.publishProject).toHaveBeenCalledWith(record);
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish project" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(publicationMocks.publishProject).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeEnabled();
  });
});
