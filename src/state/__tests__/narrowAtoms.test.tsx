import { MantineProvider } from "@mantine/core";
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import type { DraftProject } from "@/types/forms";
import { emptyProjectState, UNNAMED_PROJECT } from "@/workspace/types";
import {
  addExperimentAtom,
  replaceExperimentFormDataAtom,
  updateProjectDataAtom,
} from "../actions";
import { experimentsAtom, projectMenuAtom, projectNameAtom, projectSummariesAtom } from "../atoms";
import { useExperiment } from "../hooks";
import { createTestStore, makeWrapper, StoreWrapper, workspaceWithProject } from "../testing";

// ProjectSwitcher calls useNavigate once per render, so its call count is the render count.
const useNavigate = vi.fn(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => useNavigate() }));

describe("narrow atoms", () => {
  it("summarises a non-string research_project as Unnamed Project", () => {
    const projectData = { project_id: "", research_project: ["WCOA"] } as unknown as DraftProject;
    const store = createTestStore(workspaceWithProject({ ...emptyProjectState(), projectData }));

    expect(store.get(projectSummariesAtom)[0].name).toBe(UNNAMED_PROJECT);
    expect(store.get(projectNameAtom)).toBe(UNNAMED_PROJECT);
  });

  it("keeps the project menu stable while an experiment is edited", () => {
    const store = createTestStore(workspaceWithProject());
    const id = store.set(addExperimentAtom);
    const menu = store.get(projectMenuAtom);

    store.set(replaceExperimentFormDataAtom, id, { description: "Edited" });

    expect(store.get(projectMenuAtom)).toBe(menu);
  });

  it("keeps the experiments list when only project data changes", () => {
    const store = createTestStore(workspaceWithProject());
    store.set(addExperimentAtom);
    const experiments = store.get(experimentsAtom);

    store.set(updateProjectDataAtom, { project_id: "", research_project: "Kiel" });

    expect(store.get(experimentsAtom)).toBe(experiments);
    expect(store.get(projectNameAtom)).toBe("Kiel");
  });

  it("useExperiment returns the record for an id and undefined for null", () => {
    const store = createTestStore(workspaceWithProject());
    const id = store.set(addExperimentAtom, "First");
    const wrapper = makeWrapper(store);

    expect(renderHook(() => useExperiment(id), { wrapper }).result.current?.name).toBe("First");
    expect(renderHook(() => useExperiment(null), { wrapper }).result.current).toBeUndefined();
  });
});

describe("ProjectSwitcher render count", () => {
  beforeEach(() => useNavigate.mockClear());

  function renderSwitcher() {
    const store = createTestStore(workspaceWithProject());
    const id = store.set(addExperimentAtom);
    render(
      <MantineProvider>
        <StoreWrapper store={store}>
          <ProjectSwitcher />
        </StoreWrapper>
      </MantineProvider>,
    );
    return { store, id, renders: () => useNavigate.mock.calls.length };
  }

  it("does not re-render when an experiment's formData changes", () => {
    const { store, id, renders } = renderSwitcher();
    const before = renders();

    act(() => {
      store.set(replaceExperimentFormDataAtom, id, { name: "Typed" });
    });
    act(() => {
      store.set(replaceExperimentFormDataAtom, id, { name: "Typed more" });
    });

    expect(renders()).toBe(before);
  });

  it("re-renders when the project is renamed", () => {
    const { store, renders } = renderSwitcher();
    const before = renders();

    act(() => {
      store.set(updateProjectDataAtom, { project_id: "", research_project: "Kiel" });
    });

    expect(renders()).toBeGreaterThan(before);
  });
});
