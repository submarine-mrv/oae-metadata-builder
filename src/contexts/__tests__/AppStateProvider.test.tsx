import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyProjectState } from "@/workspace/types";
import { AppStateProvider, useAppState } from "../AppStateContext";

describe("AppStateProvider", () => {
  it("starts from initialState", () => {
    const initial = {
      ...emptyProjectState(),
      projectData: { project_id: "P1", research_project: "Seeded" },
    };
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => (
        <AppStateProvider initialState={initial}>{children}</AppStateProvider>
      ),
    });
    expect(result.current.state.projectData.research_project).toBe("Seeded");
  });

  it("selects the first experiment and dataset of the initial state", () => {
    const record = (id: number) => ({
      id,
      name: `R${id}`,
      formData: {},
      createdAt: 0,
      updatedAt: 0,
    });
    const initial = {
      ...emptyProjectState(),
      experiments: [record(3), record(4)],
      datasets: [record(7)],
      nextExperimentId: 5,
      nextDatasetId: 8,
    };
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => (
        <AppStateProvider initialState={initial}>{children}</AppStateProvider>
      ),
    });
    expect(result.current.state.activeExperimentId).toBe(3);
    expect(result.current.state.activeDatasetId).toBe(7);
  });

  it("selects nothing when the initial state has no experiments or datasets", () => {
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => <AppStateProvider>{children}</AppStateProvider>,
    });
    expect(result.current.state.activeExperimentId).toBeNull();
    expect(result.current.state.activeDatasetId).toBeNull();
  });

  it("calls onChange with the persisted subset after a change, not on mount", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => (
        <AppStateProvider onChange={onChange}>{children}</AppStateProvider>
      ),
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.updateProjectData({ project_id: "P1" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      projectData: { project_id: "P1" },
      experiments: [],
    });
    expect(onChange.mock.calls[0][0]).not.toHaveProperty("showJsonPreview");
  });

  it("does not call onChange for UI-only changes", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => (
        <AppStateProvider onChange={onChange}>{children}</AppStateProvider>
      ),
    });
    act(() => result.current.toggleJsonPreview());
    expect(onChange).not.toHaveBeenCalled();
  });
});
