import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localStorageWorkspaceStore } from "../storage";
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

  afterEach(() => {
    vi.useRealTimers();
  });

  const named = (research_project: string) => ({
    ...emptyProjectState(),
    projectData: { project_id: "", research_project },
  });

  it("starts with no projects and no active project when storage is empty", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.projects).toHaveLength(0);
    expect(result.current.activeProjectId).toBeNull();
    expect(result.current.activeProject).toBeNull();
  });

  it("creates, switches, and deletes projects", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });

    let first = "";
    let second = "";
    act(() => {
      first = result.current.createProject();
    });
    act(() => {
      second = result.current.createProject();
    });
    expect(result.current.activeProjectId).toBe(second);

    act(() => result.current.switchProject(first));
    expect(result.current.activeProjectId).toBe(first);

    act(() => result.current.deleteProject(first));
    expect(result.current.activeProjectId).toBe(second);
    expect(result.current.projects).toHaveLength(1);
  });

  it("deleting the last project leaves no active project", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    let id = "";
    act(() => {
      id = result.current.createProject();
    });
    act(() => result.current.deleteProject(id));
    expect(result.current.projects).toHaveLength(0);
    expect(result.current.activeProject).toBeNull();
  });

  it("ignores updateProject for an unknown id", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    act(() => {
      result.current.createProject();
    });
    const before = result.current.activeProject;
    act(() => result.current.updateProject("missing", named("Ghost")));
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.activeProject).toBe(before);
  });

  it("applies an edit to the project that made it, even after a switch", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    let a = "";
    let b = "";
    act(() => {
      a = result.current.createProject();
    });
    act(() => {
      b = result.current.createProject();
    });
    act(() => result.current.switchProject(b));
    act(() => result.current.updateProject(a, named("Edited A")));

    const byId = (id: string) => result.current.projects.find((p) => p.id === id);
    expect(byId(a)?.name).toBe("Edited A");
    expect(byId(b)?.name).not.toBe("Edited A");
    expect(result.current.activeProjectId).toBe(b);
  });

  it("saves create and delete immediately", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    let id = "";
    act(() => {
      id = result.current.createProject();
    });
    expect(localStorageWorkspaceStore.load()?.projects.map((p) => p.id)).toEqual([id]);

    act(() => result.current.deleteProject(id));
    expect(localStorageWorkspaceStore.load()?.projects).toHaveLength(0);
  });

  it("updates a project's state and saves after the debounce", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    let id = "";
    act(() => {
      id = result.current.createProject();
    });

    act(() => result.current.updateProject(id, named("Named")));
    expect(result.current.projects[0].name).toBe("Named");
    expect(
      localStorageWorkspaceStore.load()?.projects[0].state.projectData.research_project,
    ).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(localStorageWorkspaceStore.load()?.projects[0].state.projectData.research_project).toBe(
      "Named",
    );
  });

  it("flushes an unsaved edit on pagehide", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    let id = "";
    act(() => {
      id = result.current.createProject();
    });
    act(() => result.current.updateProject(id, named("Flushed")));

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(localStorageWorkspaceStore.load()?.projects[0].state.projectData.research_project).toBe(
      "Flushed",
    );
  });

  it("flushes an unsaved edit when the page becomes hidden", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    let id = "";
    act(() => {
      id = result.current.createProject();
    });
    act(() => result.current.updateProject(id, named("Hidden")));

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    try {
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    } finally {
      // Removes the own property so the prototype getter applies again.
      delete (document as { visibilityState?: unknown }).visibilityState;
    }
    expect(localStorageWorkspaceStore.load()?.projects[0].state.projectData.research_project).toBe(
      "Hidden",
    );
  });

  it("drops a link to an experiment that isn't in the new project", () => {
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
    expect(active).not.toBeNull();
    expect(active?.state.projectData.name).toBe("Imported");
    expect(active?.state.datasets[0].linking?.linkedExperimentInternalId).toBeNull();
    expect(result.current.projects).toHaveLength(1);
  });
});
