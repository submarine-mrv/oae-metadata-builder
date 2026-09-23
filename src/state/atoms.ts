import { atom, type SetStateAction } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  documentTitle,
  emptyProjectState,
  type ProjectRecord,
  type ProjectState,
  projectDisplayName,
  type Workspace,
} from "@/workspace/types";
import { activeProject, emptyWorkspace, updateProject } from "@/workspace/workspace";

export const workspaceAtom = atom<Workspace>(emptyWorkspace());

export const activeProjectAtom = atom<ProjectRecord | null>((get) =>
  activeProject(get(workspaceAtom)),
);

const EMPTY_PROJECT_STATE = emptyProjectState();

/** The active project's state. Writes go to the active project; without one they do nothing. */
export const projectStateAtom = atom(
  (get): ProjectState => get(activeProjectAtom)?.state ?? EMPTY_PROJECT_STATE,
  (get, set, update: SetStateAction<ProjectState>) => {
    const active = get(activeProjectAtom);
    if (!active) return;
    const next = typeof update === "function" ? update(active.state) : update;
    set(workspaceAtom, (ws) => updateProject(ws, active.id, next));
  },
);

export const showJsonPreviewAtom = atom(false);

interface Selection {
  projectId: string;
  id: number | null;
}

/**
 * The selected entity id, scoped to the project it was chosen in. Any other
 * active project, or a deleted selection, reads as that project's first entity.
 * Clearing the selection reads as null until the next selection or switch.
 */
function selectedIdAtom(entities: (state: ProjectState) => { id: number }[]) {
  const stored = atom<Selection | null>(null);
  return atom(
    (get): number | null => {
      const active = get(activeProjectAtom);
      if (!active) return null;
      const list = entities(active.state);
      const selection = get(stored);
      if (selection?.projectId === active.id) {
        if (selection.id === null) return null;
        if (list.some((e) => e.id === selection.id)) return selection.id;
      }
      return list[0]?.id ?? null;
    },
    (get, set, id: number | null) => {
      const active = get(activeProjectAtom);
      if (!active) return;
      set(stored, { projectId: active.id, id });
    },
  );
}

export const activeExperimentIdAtom = selectedIdAtom((s) => s.experiments);
export const activeDatasetIdAtom = selectedIdAtom((s) => s.datasets);

// Narrow reads. Jotai skips subscribers when a derived value is unchanged
// (Object.is), so these only re-render on edits to what they select.

export const activeProjectIdAtom = atom((get) => get(activeProjectAtom)?.id ?? null);
export const projectCountAtom = atom((get) => get(workspaceAtom).projects.length);
export const projectDataAtom = atom((get) => get(projectStateAtom).projectData);
export const experimentsAtom = atom((get) => get(projectStateAtom).experiments);
export const datasetsAtom = atom((get) => get(projectStateAtom).datasets);
export const experimentCountAtom = atom((get) => get(experimentsAtom).length);
export const projectNameAtom = atom((get) => projectDisplayName(get(projectStateAtom)));
export const documentTitleAtom = atom((get) => documentTitle(get(projectStateAtom)));

export interface ProjectSummary {
  id: string;
  name: string;
  experimentCount: number;
  datasetCount: number;
  updatedAt: number;
  isActive: boolean;
}

/** Newest first. Recomputed on every edit, since each edit bumps `updatedAt`. */
export const projectSummariesAtom = atom((get): ProjectSummary[] => {
  const activeId = get(activeProjectAtom)?.id;
  return [...get(workspaceAtom).projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => ({
      id: p.id,
      name: projectDisplayName(p.state),
      experimentCount: p.state.experiments.length,
      datasetCount: p.state.datasets.length,
      updatedAt: p.updatedAt,
      isActive: p.id === activeId,
    }));
});

export type ProjectMenuItem = Pick<ProjectSummary, "id" | "name" | "isActive">;

/** The switcher's list: same order as the summaries, but stable while only timestamps or counts change. */
export const projectMenuAtom = selectAtom(
  projectSummariesAtom,
  (list): ProjectMenuItem[] => list.map(({ id, name, isActive }) => ({ id, name, isActive })),
  (a, b) =>
    a.length === b.length &&
    a.every((x, i) => x.id === b[i].id && x.name === b[i].name && x.isActive === b[i].isActive),
);
