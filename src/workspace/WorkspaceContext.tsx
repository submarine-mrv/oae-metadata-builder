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
  createProject as createIn,
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
  activeProjectId: string;
  activeProject: ProjectRecord;
  /** Newest first. */
  projects: ProjectSummary[];
  createProject: () => string;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => void;
  importAsNewProject: (selection: ImportSelection) => string;
  updateActiveProject: (state: ProjectState) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** Links into the current project don't survive a move to a fresh one. */
function withoutExistingLinks(selection: ImportSelection): ImportSelection {
  return {
    ...selection,
    datasets: selection.datasets.map((dataset) => {
      const link = dataset.experimentLinking;
      const targetsExisting =
        link?.mode === "explicit"
          ? link.explicitExperimentInternalId !== undefined
          : link?.resolvedMatch?.type === "existing";
      return targetsExisting ? { formData: dataset.formData } : dataset;
    }),
  };
}

export function WorkspaceProvider({
  children,
  store = localStorageWorkspaceStore,
}: {
  children: React.ReactNode;
  store?: WorkspaceStore;
}) {
  const [workspace, setWorkspace] = useState<Workspace>(() => store.load() ?? emptyWorkspace());

  // Debounced save, with a flush on unload so a reload right after a change keeps it.
  const isFirstSave = useRef(true);
  const unsaved = useRef<Workspace | null>(null);
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    unsaved.current = workspace;
    const timer = setTimeout(() => {
      store.save(workspace);
      unsaved.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [workspace, store]);

  useEffect(() => {
    const flush = () => {
      if (!unsaved.current) return;
      store.save(unsaved.current);
      unsaved.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [store]);

  // Reads workspace from the closure so the new id can be returned synchronously.
  const createProject = useCallback(() => {
    const { workspace: next, id } = createIn(workspace);
    setWorkspace(next);
    return id;
  }, [workspace]);

  const switchProject = useCallback((id: string) => setWorkspace((ws) => switchIn(ws, id)), []);

  const deleteProject = useCallback((id: string) => setWorkspace((ws) => deleteIn(ws, id)), []);

  const importAsNewProject = useCallback((selection: ImportSelection) => {
    const state = applyImport(emptyProjectState(), withoutExistingLinks(selection));
    const record = newProjectRecord(state);
    setWorkspace((ws) => addProject(ws, record));
    return record.id;
  }, []);

  const updateActiveProject = useCallback(
    (state: ProjectState) => setWorkspace((ws) => updateIn(ws, ws.activeProjectId, state)),
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
        isActive: p.id === active.id,
      }));
    return {
      activeProjectId: active.id,
      activeProject: active,
      projects,
      createProject,
      switchProject,
      deleteProject,
      importAsNewProject,
      updateActiveProject,
    };
  }, [
    workspace,
    createProject,
    switchProject,
    deleteProject,
    importAsNewProject,
    updateActiveProject,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
