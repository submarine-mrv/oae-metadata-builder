import { MantineProvider } from "@mantine/core";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAtomValue } from "jotai";
import { Fragment } from "react";
import { describe, expect, it, vi } from "vitest";
import { replaceExperimentFormDataAtom, updateProjectDataAtom } from "@/state/actions";
import {
  activeDatasetIdAtom,
  activeExperimentIdAtom,
  activeProjectIdAtom,
  projectNameAtom,
} from "@/state/atoms";
import { createTestStore, StoreWrapper } from "@/state/testing";
import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import ActivePageRedirect from "../ActivePageRedirect";
import { DatasetRoute, ExperimentRoute, ProjectRoute } from "../EntityRoutes";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";
import { useCopyLink } from "../useCopyLink";

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ user: null, status: "ready" }) }));

function experiment(id: string, experimentId = ""): ExperimentRecord {
  return {
    id,
    name: `Exp ${id}`,
    formData: { experiment_id: experimentId },
    createdAt: 1,
    updatedAt: 1,
  };
}

function dataset(id: string): DatasetRecord {
  return { id, name: `Data ${id}`, formData: {}, createdAt: 1, updatedAt: 1 };
}

function project(id: string, name: string, projectId = "", experiments: ExperimentRecord[] = []) {
  return {
    ...newProjectRecord({
      ...emptyProjectState(),
      projectData: { project_id: projectId, name },
      experiments,
      datasets: [dataset(`${id}-d1`)],
    }),
    id,
  };
}

function Overview() {
  const copyLink = useCopyLink();
  const projectId = useAtomValue(activeProjectIdAtom);
  return (
    <>
      <p>Overview of {useAtomValue(projectNameAtom)}</p>
      <button type="button" onClick={() => projectId && copyLink("experiment", projectId, "e1")}>
        Copy
      </button>
    </>
  );
}

function Experiment() {
  return <p>Editing experiment {useAtomValue(activeExperimentIdAtom)}</p>;
}

function Dataset() {
  return <p>Editing dataset {useAtomValue(activeDatasetIdAtom)}</p>;
}

/** The app's route shape, with stub pages; the root remounts on project switch like the app's. */
function renderAt(url: string, workspace: Workspace) {
  const store = createTestStore(workspace);
  const rootRoute = createRootRoute({
    component: function Root() {
      return (
        <Fragment key={useAtomValue(activeProjectIdAtom) ?? "empty"}>
          <Outlet />
        </Fragment>
      );
    },
  });
  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/projects/$projectId",
    component: ProjectRoute,
  });
  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/projects",
      component: () => <p>All projects page</p>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/experiment",
      component: () => <ActivePageRedirect page="experiment">No experiment</ActivePageRedirect>,
    }),
    projectRoute.addChildren([
      createRoute({ getParentRoute: () => projectRoute, path: "/", component: Overview }),
      createRoute({
        getParentRoute: () => projectRoute,
        path: "/experiments/$experimentId",
        component: () => (
          <ExperimentRoute>
            <Experiment />
          </ExperimentRoute>
        ),
      }),
      createRoute({
        getParentRoute: () => projectRoute,
        path: "/datasets/$datasetId",
        component: () => (
          <DatasetRoute>
            <Dataset />
          </DatasetRoute>
        ),
      }),
    ]),
  ]);
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createRouter({ routeTree, history });
  render(
    <MantineProvider>
      <StoreWrapper store={store}>
        <RouterProvider router={router} />
      </StoreWrapper>
    </MantineProvider>,
  );
  return { store, router, history };
}

function workspaceOf(...projects: ReturnType<typeof project>[]): Workspace {
  return { version: 1, activeProjectId: projects[0].id, projects };
}

const pathname = (router: ReturnType<typeof renderAt>["router"]) => router.state.location.pathname;

describe("slug routes", () => {
  it("opens the project named by a human ID and switches to it", async () => {
    const { store } = renderAt(
      "/projects/KIEL",
      workspaceOf(project("p1", "Other"), project("p2", "Kiel trial", "KIEL")),
    );
    expect(await screen.findByText("Overview of Kiel trial")).toBeInTheDocument();
    expect(store.get(activeProjectIdAtom)).toBe("p2");
  });

  it("replaces a UUID URL with the human slug without adding history", async () => {
    const { router, history } = renderAt(
      "/projects/p2",
      workspaceOf(project("p1", "A"), project("p2", "B", "KIEL")),
    );
    await screen.findByText("Overview of B");
    await waitFor(() => expect(pathname(router)).toBe("/projects/KIEL"));
    expect(history.length).toBe(1);
  });

  it("selects the experiment and dataset named in the URL, not the first", async () => {
    const workspace = workspaceOf(
      project("p1", "A", "KIEL", [experiment("e1", "SITE-A"), experiment("e2", "SITE-B")]),
    );
    const { store } = renderAt("/projects/KIEL/experiments/SITE-B", workspace);
    expect(await screen.findByText("Editing experiment e2")).toBeInTheDocument();
    expect(store.get(activeExperimentIdAtom)).toBe("e2");
  });

  it("opens a dataset by internal ID", async () => {
    renderAt("/projects/p1/datasets/p1-d1", workspaceOf(project("p1", "A")));
    expect(await screen.findByText("Editing dataset p1-d1")).toBeInTheDocument();
  });

  it("follows edits to the project and experiment IDs in the URL", async () => {
    const { store, router } = renderAt(
      "/projects/KIEL/experiments/SITE-A",
      workspaceOf(project("p1", "A", "KIEL", [experiment("e1", "SITE-A")])),
    );
    await screen.findByText("Editing experiment e1");
    act(() => store.set(updateProjectDataAtom, { project_id: "KIEL-2", name: "A" }));
    await waitFor(() => expect(pathname(router)).toBe("/projects/KIEL-2/experiments/SITE-A"));
    act(() => store.set(replaceExperimentFormDataAtom, "e1", { experiment_id: "SITE-Z" }));
    await waitFor(() => expect(pathname(router)).toBe("/projects/KIEL-2/experiments/SITE-Z"));
    expect(screen.getByText("Editing experiment e1")).toBeInTheDocument();
  });

  it("encodes IDs with URL characters and resolves them back", async () => {
    const { history } = renderAt("/projects/p1", workspaceOf(project("p1", "A", "Kiel/2025 #1")));
    await screen.findByText("Overview of A");
    await waitFor(() =>
      expect(history.location.pathname).toMatch(/^\/projects\/Kiel%2F2025.*%231$/),
    );
    expect(screen.getByText("Overview of A")).toBeInTheDocument();
  });

  it("copies an absolute link with the canonical slugs", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderAt("/projects/p1", workspaceOf(project("p1", "A", "KIEL", [experiment("e1", "EXP-1")])));
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/projects/KIEL/experiments/EXP-1`,
    );
  });

  it("shows which project, experiment or dataset ID can't be found", async () => {
    renderAt("/projects/NOPE", workspaceOf(project("p1", "A")));
    expect(await screen.findByText("Project not found")).toBeInTheDocument();
    expect(screen.getByText(/Project ID "NOPE" can't be found/)).toBeInTheDocument();
  });

  it("shows a missing experiment inside its project", async () => {
    renderAt("/projects/p1/experiments/OLD-ID", workspaceOf(project("p1", "A")));
    expect(await screen.findByText("Experiment not found")).toBeInTheDocument();
    expect(
      screen.getByText(/Experiment ID "OLD-ID" can't be found in this project/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to project" })).toBeInTheDocument();
  });

  it("shows a missing dataset", async () => {
    renderAt("/projects/p1/datasets/gone", workspaceOf(project("p1", "A")));
    expect(await screen.findByText("Dataset not found")).toBeInTheDocument();
  });

  it("asks which project a duplicated human ID means, then opens the choice by UUID", async () => {
    const { store, router } = renderAt(
      "/projects/DUP",
      workspaceOf(
        project("p0", "Unrelated"),
        project("p1", "First", "DUP"),
        project("p2", "Second", "DUP"),
      ),
    );
    expect(await screen.findByText(/Project ID "DUP" matches 2 projects/)).toBeInTheDocument();
    expect(store.get(activeProjectIdAtom)).toBe("p0");
    fireEvent.click(screen.getByText("Second"));
    expect(await screen.findByText("Overview of Second")).toBeInTheDocument();
    expect(store.get(activeProjectIdAtom)).toBe("p2");
    expect(pathname(router)).toBe("/projects/p2");
  });

  it("redirects the legacy experiment path to the selected experiment's slug", async () => {
    const { router } = renderAt(
      "/experiment",
      workspaceOf(project("p1", "A", "KIEL", [experiment("e1", "SITE-A")])),
    );
    expect(await screen.findByText("Editing experiment e1")).toBeInTheDocument();
    expect(pathname(router)).toBe("/projects/KIEL/experiments/SITE-A");
  });
});
