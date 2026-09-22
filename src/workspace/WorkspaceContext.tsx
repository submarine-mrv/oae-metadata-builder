import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { applyImport, type ImportSelection } from "@/utils/applyImport";
import { localStorageWorkspaceStore, type WorkspaceStore } from "./storage";
import {
  emptyProjectState,
  newProjectRecord,
  type ProjectRecord,
  type ProjectState,
  projectDisplayName,
  type Workspace,
} from "./types";
import {
  addProject,
  deleteProject as deleteIn,
  emptyWorkspace,
  activeProject as findActive,
  switchProject as switchIn,
  updateProject as updateIn,
} from "./workspace";

const SAVE_DEBOUNCE_MS = 2000;

export interface ProjectSummary {
  id: string;
  name: string;
  experimentCount: number;
  datasetCount: number;
  updatedAt: number;
  isActive: boolean;
}

interface WorkspaceContextValue {
  activeProjectId: string | null;
  activeProject: ProjectRecord | null;
  /** Newest first. */
  projects: ProjectSummary[];
  createProject: () => string;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => void;
  importAsNewProject: (selection: ImportSelection) => string;
  updateProject: (id: string, state: ProjectState) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  store = localStorageWorkspaceStore,
}: {
  children: React.ReactNode;
  store?: WorkspaceStore;
}) {
  const [workspace, setWorkspace] = useState<Workspace>(() => store.load() ?? emptyWorkspace());

  // Edits save after a 2 s debounce; structural changes (create, delete, switch, import)
  // save at once. Pending edits are flushed when the page is hidden or unloaded.
  const synced = useRef(workspace);
  const unsaved = useRef<Workspace | null>(null);
  const saveNow = useRef(false);

  const persist = useCallback(
    (ws: Workspace) => {
      store.save(ws);
      synced.current = ws;
      unsaved.current = null;
    },
    [store],
  );

  useEffect(() => {
    if (workspace === synced.current) return;
    if (saveNow.current) {
      saveNow.current = false;
      persist(workspace);
      return;
    }
    unsaved.current = workspace;
    const timer = setTimeout(() => persist(workspace), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [workspace, persist]);

  useEffect(() => {
    const flush = () => {
      if (unsaved.current) persist(unsaved.current);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [persist]);

  const createProject = useCallback(() => {
    const record = newProjectRecord();
    saveNow.current = true;
    setWorkspace((ws) => addProject(ws, record));
    return record.id;
  }, []);

  const switchProject = useCallback((id: string) => {
    saveNow.current = true;
    setWorkspace((ws) => switchIn(ws, id));
  }, []);

  const deleteProject = useCallback((id: string) => {
    saveNow.current = true;
    setWorkspace((ws) => deleteIn(ws, id));
  }, []);

  const importAsNewProject = useCallback((selection: ImportSelection) => {
    const state = applyImport(emptyProjectState(), selection);
    const record = newProjectRecord(state);
    saveNow.current = true;
    setWorkspace((ws) => addProject(ws, record));
    return record.id;
  }, []);

  /** Writes to the project the edit came from; unknown ids are ignored. */
  const updateProject = useCallback(
    (id: string, state: ProjectState) => setWorkspace((ws) => updateIn(ws, id, state)),
    [],
  );

  const value = useMemo<WorkspaceContextValue>(() => {
    const active = findActive(workspace);
    const projects = [...workspace.projects]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((p) => ({
        id: p.id,
        name: projectDisplayName(p.state),
        experimentCount: p.state.experiments.length,
        datasetCount: p.state.datasets.length,
        updatedAt: p.updatedAt,
        isActive: p.id === active?.id,
      }));
    return {
      activeProjectId: active?.id ?? null,
      activeProject: active,
      projects,
      createProject,
      switchProject,
      deleteProject,
      importAsNewProject,
      updateProject,
    };
  }, [workspace, createProject, switchProject, deleteProject, importAsNewProject, updateProject]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
