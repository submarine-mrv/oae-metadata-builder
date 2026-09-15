import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { localStorageWorkspaceStore, WORKSPACE_KEY } from "../storage";
import { emptyProjectState } from "../types";
import { useWorkspace, WorkspaceProvider } from "../WorkspaceContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

describe("WorkspaceProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("starts with one unnamed active project when storage is empty", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0].name).toBe("Unnamed Project");
    expect(result.current.projects[0].isActive).toBe(true);
  });

  it("creates, switches, and deletes projects", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    const first = result.current.activeProjectId;

    let created = "";
    act(() => {
      created = result.current.createProject();
    });
    expect(result.current.activeProjectId).toBe(created);

    act(() => result.current.switchProject(first));
    expect(result.current.activeProjectId).toBe(first);

    act(() => result.current.deleteProject(first));
    expect(result.current.activeProjectId).toBe(created);
    expect(result.current.projects).toHaveLength(1);
  });

  it("updates the active project's state and saves after the debounce", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    const next = {
      ...emptyProjectState(),
      hasProject: true,
      projectData: { project_id: "", name: "Named" },
    };

    act(() => result.current.updateActiveProject(next));
    expect(result.current.projects[0].name).toBe("Named");
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(localStorageWorkspaceStore.load()?.projects[0].state.projectData.name).toBe("Named");
  });

  it("imports a selection as a new active project, dropping links to existing experiments", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    act(() => {
      result.current.importAsNewProject({
        project: { project_id: "P2", name: "Imported" },
        experiments: [],
        datasets: [
          {
            formData: { name: "DS" },
            experimentLinking: { mode: "explicit", explicitExperimentInternalId: 1 },
          },
        ],
      });
    });
    const active = result.current.activeProject;
    expect(active.state.projectData.name).toBe("Imported");
    expect(active.state.datasets[0].linking?.linkedExperimentInternalId).toBeNull();
    expect(result.current.projects).toHaveLength(2);
  });
});
