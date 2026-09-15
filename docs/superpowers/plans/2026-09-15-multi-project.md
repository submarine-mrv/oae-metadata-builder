# Multi-project Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user keep several OAE projects in the browser, switch between them from the header, manage them on a `/projects` page, and have all of it persist locally in a shape a later cloud-sync PR can adopt.

**Architecture:** A `WorkspaceProvider` above the existing `AppStateProvider` owns the list of projects, the active id, and localStorage persistence. `AppStateProvider` becomes a live editing session for one project: it takes `initialState` and reports changes through `onChange`, and is mounted with `key={activeProjectId}` so switching projects remounts it. Two pure functions (`parseProjectState`, `applyImport`) are extracted from the context so the workspace and the context share them.

**Tech Stack:** React 19, TanStack Router file routes, Mantine v8, Vitest (jsdom), Playwright, Biome. Node via mise: run npm as `bash -l -c 'mise exec -- npm …'`.

**Spec:** `docs/superpowers/specs/2026-09-15-multi-project-design.md`

**Working directory:** `/Users/cory/Code/oae-data/oae-form-multi-project` (worktree on branch `feat/multi-project`, off `origin/dev`). Commit after every task, one line, Conventional Commits, no bylines.

---

## File map

| File | Responsibility |
|---|---|
| `src/workspace/types.ts` | `ProjectState`, `ProjectRecord`, `Workspace`, `projectDisplayName`, `emptyProjectState`, `newProjectRecord` |
| `src/workspace/workspace.ts` | Pure workspace transitions: create, switch, delete, add, update |
| `src/workspace/storage.ts` | `WorkspaceStore` interface, localStorage implementation, legacy-session migration |
| `src/workspace/WorkspaceContext.tsx` | `WorkspaceProvider`, `useWorkspace()`, debounced save |
| `src/utils/parseProjectState.ts` | Parse/migrate a persisted `ProjectState` (moved out of `restoreFullState`) |
| `src/utils/applyImport.ts` | Pure import reducer (moved out of `importSelectedData`) |
| `src/utils/relativeTime.ts` | "2 hours ago" formatting for project cards |
| `src/components/ProjectSwitcher.tsx` | Header dropdown |
| `src/pages/projects/ProjectsPage.tsx`, `src/pages/projects/ProjectCard.tsx` | `/projects` page |
| `src/routes/projects.tsx` | Route file |
| Modified: `src/contexts/AppStateContext.tsx`, `src/App.tsx`, `src/components/Navigation.tsx`, `src/components/ImportPreviewModal.tsx` | Integration |
| Deleted: `src/components/SessionManager.tsx`, `src/components/SessionRestoreModal.tsx`, `src/hooks/useSessionPersistence.ts` | Replaced by the workspace |
| `e2e/projects.spec.ts` | End-to-end coverage |
| `docs/multi-project.md` | Pattern doc |

---

### Task 1: Workspace types and name derivation

**Files:**
- Create: `src/workspace/types.ts`
- Test: `src/workspace/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/workspace/__tests__/types.test.ts
import { describe, expect, it } from "vitest";
import {
  emptyProjectState,
  newProjectRecord,
  projectDisplayName,
  UNNAMED_PROJECT,
} from "../types";

describe("projectDisplayName", () => {
  it("falls back to Unnamed Project when there is no name", () => {
    expect(projectDisplayName(emptyProjectState())).toBe(UNNAMED_PROJECT);
    expect(
      projectDisplayName({ ...emptyProjectState(), projectData: { project_id: "", name: "   " } }),
    ).toBe(UNNAMED_PROJECT);
  });

  it("uses the trimmed Research Project name", () => {
    const state = { ...emptyProjectState(), projectData: { project_id: "", name: "  Kiel trial " } };
    expect(projectDisplayName(state)).toBe("Kiel trial");
  });
});

describe("newProjectRecord", () => {
  it("gives every record a unique id and matching timestamps", () => {
    const a = newProjectRecord(undefined, 1000);
    const b = newProjectRecord(undefined, 1000);
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBe(1000);
    expect(a.updatedAt).toBe(1000);
    expect(a.state).toEqual(emptyProjectState());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace/__tests__/types.test.ts'`
Expected: FAIL with "Cannot find module '../types'"

- [ ] **Step 3: Write the implementation**

```ts
// src/workspace/types.ts
import type { DatasetState, DraftProject, ExperimentState } from "@/types/forms";

/** Everything one project owns. Same shape the single-session autosave used. */
export interface ProjectState {
  hasProject: boolean;
  projectData: DraftProject;
  experiments: ExperimentState[];
  datasets: DatasetState[];
  nextExperimentId: number;
  nextDatasetId: number;
}

export interface ProjectRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: ProjectState;
}

export interface Workspace {
  version: 1;
  activeProjectId: string;
  projects: ProjectRecord[];
}

export const UNNAMED_PROJECT = "Unnamed Project";

/** The Research Project name, or a placeholder. Never stored. */
export function projectDisplayName(state: ProjectState): string {
  return state.projectData.name?.trim() || UNNAMED_PROJECT;
}

export function emptyProjectState(): ProjectState {
  return {
    hasProject: false,
    projectData: { project_id: "" },
    experiments: [],
    datasets: [],
    nextExperimentId: 1,
    nextDatasetId: 1,
  };
}

export function newProjectRecord(
  state: ProjectState = emptyProjectState(),
  now: number = Date.now(),
): ProjectRecord {
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, state };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace/__tests__/types.test.ts'`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/workspace/types.ts src/workspace/__tests__/types.test.ts
git commit -m "feat(workspace): project state types and display name"
```

---

### Task 2: Pure workspace transitions

**Files:**
- Create: `src/workspace/workspace.ts`
- Test: `src/workspace/__tests__/workspace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/workspace/__tests__/workspace.test.ts
import { describe, expect, it } from "vitest";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";
import {
  addProject,
  createProject,
  deleteProject,
  emptyWorkspace,
  switchProject,
  updateProject,
} from "../workspace";

function twoProjects(): Workspace {
  const a = newProjectRecord(undefined, 100);
  const b = newProjectRecord(undefined, 200);
  return { version: 1, activeProjectId: a.id, projects: [a, b] };
}

describe("emptyWorkspace", () => {
  it("starts with one unnamed, active project", () => {
    const ws = emptyWorkspace();
    expect(ws.projects).toHaveLength(1);
    expect(ws.activeProjectId).toBe(ws.projects[0].id);
    expect(ws.projects[0].state.hasProject).toBe(false);
  });
});

describe("createProject", () => {
  it("adds a project with hasProject set and makes it active", () => {
    const ws = twoProjects();
    const { workspace, id } = createProject(ws, 300);
    expect(workspace.projects).toHaveLength(3);
    expect(workspace.activeProjectId).toBe(id);
    expect(workspace.projects.find((p) => p.id === id)?.state.hasProject).toBe(true);
  });
});

describe("switchProject", () => {
  it("changes the active id when it exists and ignores unknown ids", () => {
    const ws = twoProjects();
    const target = ws.projects[1].id;
    expect(switchProject(ws, target).activeProjectId).toBe(target);
    expect(switchProject(ws, "nope").activeProjectId).toBe(ws.activeProjectId);
  });
});

describe("deleteProject", () => {
  it("removes the project and keeps the active one when it was not deleted", () => {
    const ws = twoProjects();
    const result = deleteProject(ws, ws.projects[1].id, 400);
    expect(result.projects).toHaveLength(1);
    expect(result.activeProjectId).toBe(ws.projects[0].id);
  });

  it("activates the most recently edited remaining project when the active one is deleted", () => {
    const ws = twoProjects();
    const result = deleteProject(ws, ws.projects[0].id, 400);
    expect(result.activeProjectId).toBe(ws.projects[1].id);
  });

  it("creates a fresh unnamed project when the last one is deleted", () => {
    const ws = emptyWorkspace();
    const result = deleteProject(ws, ws.projects[0].id, 400);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].id).not.toBe(ws.projects[0].id);
    expect(result.activeProjectId).toBe(result.projects[0].id);
  });
});

describe("updateProject", () => {
  it("replaces the state and bumps updatedAt only for that project", () => {
    const ws = twoProjects();
    const next = { ...emptyProjectState(), hasProject: true };
    const result = updateProject(ws, ws.projects[0].id, next, 500);
    expect(result.projects[0].state).toBe(next);
    expect(result.projects[0].updatedAt).toBe(500);
    expect(result.projects[1].updatedAt).toBe(200);
  });

  it("returns the same workspace when nothing changed", () => {
    const ws = twoProjects();
    expect(updateProject(ws, ws.projects[0].id, ws.projects[0].state, 500)).toBe(ws);
  });
});

describe("addProject", () => {
  it("adds a record and makes it active", () => {
    const ws = twoProjects();
    const record = newProjectRecord(undefined, 600);
    const result = addProject(ws, record);
    expect(result.projects).toContain(record);
    expect(result.activeProjectId).toBe(record.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace/__tests__/workspace.test.ts'`
Expected: FAIL with "Cannot find module '../workspace'"

- [ ] **Step 3: Write the implementation**

```ts
// src/workspace/workspace.ts
import {
  emptyProjectState,
  newProjectRecord,
  type ProjectRecord,
  type ProjectState,
  type Workspace,
} from "./types";

export function emptyWorkspace(now: number = Date.now()): Workspace {
  const project = newProjectRecord(undefined, now);
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

export function addProject(workspace: Workspace, record: ProjectRecord): Workspace {
  return { ...workspace, activeProjectId: record.id, projects: [...workspace.projects, record] };
}

/** A new project ready for the project form, made active. */
export function createProject(
  workspace: Workspace,
  now: number = Date.now(),
): { workspace: Workspace; id: string } {
  const record = newProjectRecord({ ...emptyProjectState(), hasProject: true }, now);
  return { workspace: addProject(workspace, record), id: record.id };
}

export function switchProject(workspace: Workspace, id: string): Workspace {
  if (!workspace.projects.some((p) => p.id === id)) return workspace;
  return { ...workspace, activeProjectId: id };
}

export function deleteProject(
  workspace: Workspace,
  id: string,
  now: number = Date.now(),
): Workspace {
  const projects = workspace.projects.filter((p) => p.id !== id);
  if (projects.length === workspace.projects.length) return workspace;

  if (projects.length === 0) return emptyWorkspace(now);

  if (workspace.activeProjectId !== id) return { ...workspace, projects };

  const mostRecent = projects.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  return { ...workspace, activeProjectId: mostRecent.id, projects };
}

export function updateProject(
  workspace: Workspace,
  id: string,
  state: ProjectState,
  now: number = Date.now(),
): Workspace {
  const index = workspace.projects.findIndex((p) => p.id === id);
  if (index === -1 || workspace.projects[index].state === state) return workspace;

  const projects = [...workspace.projects];
  projects[index] = { ...projects[index], state, updatedAt: now };
  return { ...workspace, projects };
}

export function activeProject(workspace: Workspace): ProjectRecord {
  return workspace.projects.find((p) => p.id === workspace.activeProjectId) ?? workspace.projects[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace/__tests__/workspace.test.ts'`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/workspace/workspace.ts src/workspace/__tests__/workspace.test.ts
git commit -m "feat(workspace): pure create, switch, delete, and update transitions"
```

---

### Task 3: Storage with legacy-session migration

**Files:**
- Create: `src/workspace/storage.ts`
- Test: `src/workspace/__tests__/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/workspace/__tests__/storage.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";
import { LEGACY_SESSION_KEY, localStorageWorkspaceStore, WORKSPACE_KEY } from "../storage";

function workspaceFixture(): Workspace {
  const project = newProjectRecord({ ...emptyProjectState(), hasProject: true }, 100);
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

describe("localStorageWorkspaceStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(localStorageWorkspaceStore.load()).toBeNull();
  });

  it("round-trips a workspace", () => {
    const ws = workspaceFixture();
    localStorageWorkspaceStore.save(ws);
    expect(localStorageWorkspaceStore.load()).toEqual(ws);
  });

  it("drops malformed data instead of throwing", () => {
    localStorage.setItem(WORKSPACE_KEY, '{"version":1,"projects":"nope"}');
    expect(localStorageWorkspaceStore.load()).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  });

  it("migrates a legacy single session into the first project and removes the old key", () => {
    localStorage.setItem(
      LEGACY_SESSION_KEY,
      JSON.stringify({
        savedAt: 1234,
        hasProject: true,
        projectData: { project_id: "P1", name: "Old project" },
        experiments: [],
        datasets: [],
        nextExperimentId: 3,
        nextDatasetId: 2,
      }),
    );

    const ws = localStorageWorkspaceStore.load();
    expect(ws).not.toBeNull();
    expect(ws?.projects).toHaveLength(1);
    expect(ws?.projects[0].state.projectData.name).toBe("Old project");
    expect(ws?.projects[0].createdAt).toBe(1234);
    expect(ws?.activeProjectId).toBe(ws?.projects[0].id);
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
  });

  it("ignores a malformed legacy session", () => {
    localStorage.setItem(LEGACY_SESSION_KEY, '{"hasProject":true}');
    expect(localStorageWorkspaceStore.load()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace/__tests__/storage.test.ts'`
Expected: FAIL with "Cannot find module '../storage'"

- [ ] **Step 3: Write the implementation**

```ts
// src/workspace/storage.ts
import { newProjectRecord, type ProjectRecord, type ProjectState, type Workspace } from "./types";

export const WORKSPACE_KEY = "oae-metadata-builder-workspace";
/** Pre-workspace single-session autosave. Read once, then removed. */
export const LEGACY_SESSION_KEY = "oae-metadata-builder-session";

/** The seam a cloud-backed implementation replaces. */
export interface WorkspaceStore {
  load(): Workspace | null;
  save(workspace: Workspace): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProjectState(value: unknown): value is ProjectState {
  if (!isRecord(value)) return false;
  return (
    typeof value.hasProject === "boolean" &&
    isRecord(value.projectData) &&
    Array.isArray(value.experiments) &&
    Array.isArray(value.datasets) &&
    typeof value.nextExperimentId === "number" &&
    typeof value.nextDatasetId === "number"
  );
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    isProjectState(value.state)
  );
}

export function isWorkspace(value: unknown): value is Workspace {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    typeof value.activeProjectId === "string" &&
    Array.isArray(value.projects) &&
    value.projects.length > 0 &&
    value.projects.every(isProjectRecord)
  );
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to clean up.
  }
}

/** Wraps a legacy saved session as a project record, or null if it isn't one. */
export function migrateLegacySession(raw: unknown): ProjectRecord | null {
  if (!isRecord(raw) || typeof raw.savedAt !== "number" || !isProjectState(raw)) return null;
  const { savedAt, ...state } = raw as ProjectState & { savedAt: number };
  return newProjectRecord(state, savedAt);
}

export const localStorageWorkspaceStore: WorkspaceStore = {
  load() {
    const stored = readJson(WORKSPACE_KEY);
    if (stored !== null) {
      if (isWorkspace(stored)) return stored;
      remove(WORKSPACE_KEY);
    }

    const legacy = migrateLegacySession(readJson(LEGACY_SESSION_KEY));
    if (!legacy) return null;
    const workspace: Workspace = { version: 1, activeProjectId: legacy.id, projects: [legacy] };
    this.save(workspace);
    remove(LEGACY_SESSION_KEY);
    return workspace;
  },

  save(workspace) {
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    } catch {
      // Quota or unavailable storage; the in-memory workspace keeps working.
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace/__tests__/storage.test.ts'`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/workspace/storage.ts src/workspace/__tests__/storage.test.ts
git commit -m "feat(workspace): localStorage store with legacy session migration"
```

---

### Task 4: Extract `parseProjectState` from `restoreFullState`

**Files:**
- Create: `src/utils/parseProjectState.ts`
- Modify: `src/contexts/AppStateContext.tsx:882-925` (the `restoreFullState` callback) and its type at `:154-161`
- Test: `src/utils/__tests__/parseProjectState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/__tests__/parseProjectState.test.ts
import { describe, expect, it } from "vitest";
import { emptyProjectState } from "@/workspace/types";
import { parseProjectState } from "../parseProjectState";

describe("parseProjectState", () => {
  it("returns an equivalent state for an empty project", () => {
    const parsed = parseProjectState(emptyProjectState());
    expect(parsed.hasProject).toBe(false);
    expect(parsed.experiments).toEqual([]);
    expect(parsed.datasets).toEqual([]);
    expect(parsed.nextExperimentId).toBe(1);
  });

  it("re-derives experiment_types from the parsed form data", () => {
    const parsed = parseProjectState({
      ...emptyProjectState(),
      experiments: [
        {
          id: 1,
          name: "Exp",
          formData: { experiment_id: "E1", experiment_types: ["intervention"] },
          experiment_types: ["model", "intervention"],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(parsed.experiments[0].experiment_types).toEqual(
      parsed.experiments[0].formData.experiment_types,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/utils/__tests__/parseProjectState.test.ts'`
Expected: FAIL with "Cannot find module '../parseProjectState'"

- [ ] **Step 3: Create the module by moving the parse block**

Move the body of `restoreFullState` (everything between `(saved) => {` and the `setState` call, i.e. the `cleanedExperiments` and `cleanedDatasets` computations and the `parseProject(migrateFormData(saved.projectData))` expression) into:

```ts
// src/utils/parseProjectState.ts
import type { JSONSchema } from "@/components/schemaUtils";
import type { ProjectState } from "@/workspace/types";
import { migrateFormData } from "./migrations";
import { parseDataset, parseExperiment, parseProject } from "./parseEntity";
import { getBaseSchema } from "./schemaViews";

/**
 * Parse a persisted project at the boundary. A project may have been saved
 * before the current invariants existed or under an older app version, so
 * parseExperiment/parseDataset re-establish model exclusivity, type-scoped
 * fields and clean variables, and migrate handles the legacy bounding box.
 */
export function parseProjectState(saved: ProjectState): ProjectState {
  const experiments = saved.experiments.map((exp) => {
    const formData = parseExperiment(migrateFormData(exp.formData));
    return {
      ...exp,
      formData,
      // A legacy session may carry a stale top-level copy that the parse just normalized.
      experiment_types: formData.experiment_types,
    };
  });
  const datasets = saved.datasets.map((ds) => ({
    ...ds,
    formData: parseDataset(migrateFormData(ds.formData), getBaseSchema() as unknown as JSONSchema),
  }));
  return {
    hasProject: saved.hasProject,
    projectData: parseProject(migrateFormData(saved.projectData)),
    experiments,
    datasets,
    nextExperimentId: saved.nextExperimentId,
    nextDatasetId: saved.nextDatasetId,
  };
}
```

Then in `src/contexts/AppStateContext.tsx` replace the whole `restoreFullState` callback with:

```ts
  const restoreFullState = useCallback((saved: ProjectState) => {
    setState((prev) => ({ ...prev, ...parseProjectState(saved) }));
  }, []);
```

and its type at `:154-161` with `restoreFullState: (saved: ProjectState) => void;`. Add the imports `import type { ProjectState } from "@/workspace/types";` and `import { parseProjectState } from "@/utils/parseProjectState";`. Remove the now-unused imports `migrateFormData`, `parseDataset`, `parseExperiment`, `parseProject`, `getBaseSchema`, and `JSONSchema` from the context **only if** nothing else in the file uses them (grep first: `grep -n "parseExperiment\|parseDataset\|parseProject\|migrateFormData\|getBaseSchema\|JSONSchema" src/contexts/AppStateContext.tsx`).

- [ ] **Step 4: Run tests and the type check**

Run: `bash -l -c 'mise exec -- npx vitest run src/utils/__tests__/parseProjectState.test.ts src/contexts'`
Expected: PASS
Run: `bash -l -c 'mise exec -- npm run build'`
Expected: `✓ built`, no `error TS`

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseProjectState.ts src/utils/__tests__/parseProjectState.test.ts src/contexts/AppStateContext.tsx
git commit -m "refactor(state): extract parseProjectState from restoreFullState"
```

---

### Task 5: Extract `applyImport` from `importSelectedData`

**Files:**
- Create: `src/utils/applyImport.ts`
- Modify: `src/contexts/AppStateContext.tsx:705-858` (the `importSelectedData` callback)
- Test: `src/utils/__tests__/applyImport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/__tests__/applyImport.test.ts
import { describe, expect, it } from "vitest";
import { emptyProjectState } from "@/workspace/types";
import { applyImport } from "../applyImport";

describe("applyImport", () => {
  it("adds experiments and datasets to an empty project and links by import key", () => {
    const result = applyImport(emptyProjectState(), {
      project: { project_id: "P1", name: "Imported" },
      experiments: [{ experiment_id: "E1", name: "First" }],
      datasets: [
        {
          formData: { name: "DS" },
          experimentLinking: {
            mode: "use-file",
            resolvedMatch: { type: "importing", importKey: "experiment-0" },
          },
        },
      ],
    });

    expect(result.hasProject).toBe(true);
    expect(result.projectData.name).toBe("Imported");
    expect(result.experiments).toHaveLength(1);
    expect(result.experiments[0].id).toBe(1);
    expect(result.nextExperimentId).toBe(2);
    expect(result.datasets[0].linking?.linkedExperimentInternalId).toBe(1);
    expect(result.datasets[0].formData.experiment_id).toBe("E1");
    expect(result.nextDatasetId).toBe(2);
  });

  it("replaces an experiment with a matching experiment_id instead of duplicating it", () => {
    const prev = applyImport(emptyProjectState(), {
      project: null,
      experiments: [{ experiment_id: "E1", name: "Old" }],
      datasets: [],
    });
    const result = applyImport(prev, {
      project: null,
      experiments: [{ experiment_id: "E1", name: "New" }],
      datasets: [],
    });
    expect(result.experiments).toHaveLength(1);
    expect(result.experiments[0].name).toBe("New");
    expect(result.hasProject).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/utils/__tests__/applyImport.test.ts'`
Expected: FAIL with "Cannot find module '../applyImport'"

- [ ] **Step 3: Create the module by moving the reducer body**

Create `src/utils/applyImport.ts` with this header, then paste the **entire body** of the `setState((prev) => { … })` updater from `importSelectedData` (`AppStateContext.tsx:714-855`, from `// Normalize incoming data` through the `return {…}`) as the function body, with two edits: `projectData` becomes `selection.project`, `experiments` becomes `selection.experiments`, `datasets` becomes `selection.datasets`; and the returned object drops `activeTab` and the `...prev` spread, returning exactly the six `ProjectState` fields.

```ts
// src/utils/applyImport.ts
import type { DatasetExperimentLinking } from "@/hooks/useImportPreview";
import type {
  DatasetLinkingMetadata,
  DraftDataset,
  DraftExperiment,
  DraftProject,
} from "@/types/forms";
import type { ProjectState } from "@/workspace/types";
import { cleanFormData } from "./formDataCleanup";

export interface ImportSelection {
  project: DraftProject | null;
  experiments: DraftExperiment[];
  datasets: Array<{ formData: DraftDataset; experimentLinking?: DatasetExperimentLinking }>;
}

/**
 * Merge an import selection into a project. Experiments replace an existing
 * one with the same experiment_id; datasets are always added. Pure, so the
 * in-place import and "import as a new project" share it.
 */
export function applyImport(prev: ProjectState, selection: ImportSelection): ProjectState {
  const { project: projectData, experiments, datasets } = selection;
  // … moved body from AppStateContext.tsx:715-843 …
  return {
    hasProject,
    projectData: newProjectData,
    experiments: newExperiments,
    datasets: newDatasets,
    nextExperimentId: nextExpId,
    nextDatasetId: nextDsId,
  };
}
```

Check `DatasetLinkingMetadata` is exported from `@/types/forms` (the context imports it from there today; `grep -n "DatasetLinkingMetadata" src/types/forms.ts`).

Then replace the whole `importSelectedData` callback in the context with:

```ts
  const importSelectedData = useCallback(
    (
      projectData: DraftProject | null,
      experiments: DraftExperiment[],
      datasets: ImportSelection["datasets"],
    ) => {
      setState((prev) => ({
        ...prev,
        ...applyImport(prev, { project: projectData, experiments, datasets }),
        activeTab: "overview" as const,
      }));
    },
    [],
  );
```

with `import { applyImport, type ImportSelection } from "@/utils/applyImport";`. Remove `cleanFormData` and `DatasetExperimentLinking` imports from the context if nothing else uses them (grep first).

- [ ] **Step 4: Run tests and the type check**

Run: `bash -l -c 'mise exec -- npx vitest run src/utils/__tests__/applyImport.test.ts src/contexts src/hooks'`
Expected: PASS
Run: `bash -l -c 'mise exec -- npm run build'`
Expected: `✓ built`

- [ ] **Step 5: Commit**

```bash
git add src/utils/applyImport.ts src/utils/__tests__/applyImport.test.ts src/contexts/AppStateContext.tsx
git commit -m "refactor(state): extract applyImport from importSelectedData"
```

---

### Task 6: `AppStateProvider` takes `initialState` and reports `onChange`

**Files:**
- Modify: `src/contexts/AppStateContext.tsx:166-180` (provider signature and `useState`), plus the `value` object

- [ ] **Step 1: Write the failing test**

```ts
// src/contexts/__tests__/AppStateProvider.test.tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyProjectState } from "@/workspace/types";
import { AppStateProvider, useAppState } from "../AppStateContext";

describe("AppStateProvider", () => {
  it("starts from initialState", () => {
    const initial = {
      ...emptyProjectState(),
      hasProject: true,
      projectData: { project_id: "P1", name: "Seeded" },
    };
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => (
        <AppStateProvider initialState={initial}>{children}</AppStateProvider>
      ),
    });
    expect(result.current.state.hasProject).toBe(true);
    expect(result.current.state.projectData.name).toBe("Seeded");
  });

  it("calls onChange with the persisted subset after a change, not on mount", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => (
        <AppStateProvider onChange={onChange}>{children}</AppStateProvider>
      ),
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.createProject());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ hasProject: true, experiments: [] });
    expect(onChange.mock.calls[0][0]).not.toHaveProperty("activeTab");
  });

  it("does not call onChange for UI-only changes", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAppState(), {
      wrapper: ({ children }) => (
        <AppStateProvider onChange={onChange}>{children}</AppStateProvider>
      ),
    });
    act(() => result.current.setActiveTab("project"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/contexts/__tests__/AppStateProvider.test.tsx'`
Expected: FAIL (type error or `initialState` ignored: "Seeded" not found)

- [ ] **Step 3: Implement the props**

Replace the provider's opening (currently `export function AppStateProvider({ children }: { children: React.ReactNode }) {` and the `useState<AppState>({ … })` block) with:

```ts
interface AppStateProviderProps {
  children: React.ReactNode;
  /** Persisted project to edit. Parsed at the boundary like a restored session. */
  initialState?: ProjectState;
  /** Fired after any change to the persisted subset of state. */
  onChange?: (state: ProjectState) => void;
}

const UI_INITIAL_STATE = {
  activeTab: "overview" as const,
  activeExperimentId: null,
  activeDatasetId: null,
  triggerValidation: false,
  showJsonPreview: false,
};

function persistedSubset(state: AppState): ProjectState {
  return {
    hasProject: state.hasProject,
    projectData: state.projectData,
    experiments: state.experiments,
    datasets: state.datasets,
    nextExperimentId: state.nextExperimentId,
    nextDatasetId: state.nextDatasetId,
  };
}

function sameProjectState(a: ProjectState, b: ProjectState): boolean {
  return (
    a.hasProject === b.hasProject &&
    a.projectData === b.projectData &&
    a.experiments === b.experiments &&
    a.datasets === b.datasets &&
    a.nextExperimentId === b.nextExperimentId &&
    a.nextDatasetId === b.nextDatasetId
  );
}

export function AppStateProvider({ children, initialState, onChange }: AppStateProviderProps) {
  const [state, setState] = useState<AppState>(() => ({
    ...UI_INITIAL_STATE,
    ...(initialState ? parseProjectState(initialState) : emptyProjectState()),
  }));

  // Report persisted changes to the owner without re-subscribing on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastReported = useRef(persistedSubset(state));
  useEffect(() => {
    const current = persistedSubset(state);
    if (sameProjectState(current, lastReported.current)) return;
    lastReported.current = current;
    onChangeRef.current?.(current);
  }, [state]);
```

Add `useEffect` and `useRef` to the React import and `import { emptyProjectState, type ProjectState } from "@/workspace/types";`. Everything below (the callbacks and `value`) stays as is.

- [ ] **Step 4: Run tests and the type check**

Run: `bash -l -c 'mise exec -- npx vitest run src/contexts'`
Expected: PASS, including the 3 new tests
Run: `bash -l -c 'mise exec -- npm run build'`
Expected: `✓ built`

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AppStateContext.tsx src/contexts/__tests__/AppStateProvider.test.tsx
git commit -m "feat(state): AppStateProvider accepts initialState and reports onChange"
```

---

### Task 7: `WorkspaceProvider` and `useWorkspace`

**Files:**
- Create: `src/workspace/WorkspaceContext.tsx`
- Test: `src/workspace/__tests__/WorkspaceContext.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/workspace/__tests__/WorkspaceContext.test.tsx
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
    const next = { ...emptyProjectState(), hasProject: true, projectData: { project_id: "", name: "Named" } };

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace/__tests__/WorkspaceContext.test.tsx'`
Expected: FAIL with "Cannot find module '../WorkspaceContext'"

- [ ] **Step 3: Write the provider**

```tsx
// src/workspace/WorkspaceContext.tsx
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  activeProject as findActive,
  addProject,
  createProject as createIn,
  deleteProject as deleteIn,
  emptyWorkspace,
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

  const isFirstSave = useRef(true);
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    const timer = setTimeout(() => store.save(workspace), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [workspace, store]);

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
  }, [workspace, createProject, switchProject, deleteProject, importAsNewProject, updateActiveProject]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
```

Note on `createProject`: it reads `workspace` from the closure so it can return the new id synchronously; the dependency on `workspace` keeps that read current.

- [ ] **Step 4: Run tests**

Run: `bash -l -c 'mise exec -- npx vitest run src/workspace'`
Expected: PASS, all workspace tests

- [ ] **Step 5: Commit**

```bash
git add src/workspace/WorkspaceContext.tsx src/workspace/__tests__/WorkspaceContext.test.tsx
git commit -m "feat(workspace): WorkspaceProvider with debounced persistence"
```

---

### Task 8: Wire the providers and retire the session modules

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/SessionManager.tsx`, `src/components/SessionRestoreModal.tsx`, `src/hooks/useSessionPersistence.ts`

- [ ] **Step 1: Replace `App.tsx`**

```tsx
// src/App.tsx
import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "@tanstack/react-router";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
import { router } from "./router";

/** One editing session per active project; switching remounts it with that project's state. */
function ActiveProjectSession() {
  const { activeProjectId, activeProject, updateActiveProject } = useWorkspace();
  return (
    <AppStateProvider
      key={activeProjectId}
      initialState={activeProject.state}
      onChange={updateActiveProject}
    >
      <RouterProvider router={router} />
    </AppStateProvider>
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <WorkspaceProvider>
        <ActiveProjectSession />
      </WorkspaceProvider>
    </MantineProvider>
  );
}
```

- [ ] **Step 2: Delete the session modules**

```bash
git rm src/components/SessionManager.tsx src/components/SessionRestoreModal.tsx src/hooks/useSessionPersistence.ts
grep -rn "SessionManager\|SessionRestoreModal\|useSessionPersistence\|restoreFullState" src e2e
```

Expected: the grep prints only the `restoreFullState` definition and `value` entry inside `AppStateContext.tsx`. Remove those two lines and the `restoreFullState` entry in `AppStateContextType` too; nothing calls it any more.

- [ ] **Step 3: Build and run the whole unit suite**

Run: `bash -l -c 'mise exec -- npm run build'` then `bash -l -c 'mise exec -- npx vitest run'`
Expected: `✓ built`; all tests pass

- [ ] **Step 4: Smoke it in the browser**

Run: `bash -l -c 'mise exec -- npm run dev'`, open `http://localhost:3000/overview`, create a project, type a Research Project name, reload. Expected: the name is still there (workspace autosave), and there is no "restore session" modal. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(workspace): mount the active project session from the workspace"
```

---

### Task 9: Relative time helper

**Files:**
- Create: `src/utils/relativeTime.ts`
- Test: `src/utils/__tests__/relativeTime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/__tests__/relativeTime.test.ts
import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../relativeTime";

const NOW = Date.parse("2026-09-15T12:00:00Z");

describe("formatRelativeTime", () => {
  it.each([
    [NOW - 20_000, "just now"],
    [NOW - 5 * 60_000, "5 minutes ago"],
    [NOW - 60 * 60_000, "1 hour ago"],
    [NOW - 3 * 24 * 60 * 60_000, "3 days ago"],
    [NOW - 40 * 24 * 60 * 60_000, "1 month ago"],
  ])("formats %d as %s", (then, expected) => {
    expect(formatRelativeTime(then, NOW)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -l -c 'mise exec -- npx vitest run src/utils/__tests__/relativeTime.test.ts'`
Expected: FAIL with "Cannot find module '../relativeTime'"

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/relativeTime.ts
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60_000],
  ["month", 30 * 24 * 60 * 60_000],
  ["day", 24 * 60 * 60_000],
  ["hour", 60 * 60_000],
  ["minute", 60_000],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/** "5 minutes ago", "3 days ago"; anything under a minute is "just now". */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const elapsed = now - timestamp;
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) return formatter.format(-Math.floor(elapsed / ms), unit);
  }
  return "just now";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -l -c 'mise exec -- npx vitest run src/utils/__tests__/relativeTime.test.ts'`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/relativeTime.ts src/utils/__tests__/relativeTime.test.ts
git commit -m "feat(utils): relative time formatter"
```

---

### Task 10: Header project switcher

**Files:**
- Create: `src/components/ProjectSwitcher.tsx`
- Modify: `src/components/Navigation.tsx:143-155` (the brand link)

- [ ] **Step 1: Write the switcher**

```tsx
// src/components/ProjectSwitcher.tsx
import { Button, Menu, Text } from "@mantine/core";
import { IconCheck, IconChevronDown, IconFolders, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "@/contexts/AppStateContext";
import { projectDisplayName } from "@/workspace/types";
import { useWorkspace } from "@/workspace/WorkspaceContext";

/** The active project's name as the header title, with a menu to change it. */
export default function ProjectSwitcher() {
  const { projects, activeProjectId, createProject, switchProject } = useWorkspace();
  const { state } = useAppState();
  const navigate = useNavigate();

  // Live from the editing session, so the title follows the Research Project name as it's typed.
  const activeName = projectDisplayName(state);

  const handleNew = () => {
    createProject();
    navigate({ to: "/project" });
  };

  const handleSwitch = (id: string) => {
    if (id !== activeProjectId) switchProject(id);
    navigate({ to: "/overview" });
  };

  return (
    <Menu shadow="md" width={320} position="bottom-start">
      <Menu.Target>
        <Button
          variant="subtle"
          color="hadal"
          size="compact-lg"
          ff="var(--font-display)"
          rightSection={<IconChevronDown size={16} />}
          aria-label={`Current project: ${activeName}`}
          styles={{ label: { maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" } }}
        >
          {activeName}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Projects</Menu.Label>
        {projects.map((project) => (
          <Menu.Item
            key={project.id}
            onClick={() => handleSwitch(project.id)}
            leftSection={
              project.isActive ? <IconCheck size={16} /> : <span style={{ display: "inline-block", width: 16 }} />
            }
          >
            <Text size="sm" truncate>
              {project.id === activeProjectId ? activeName : project.name}
            </Text>
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<IconPlus size={16} />} onClick={handleNew}>
          New project
        </Menu.Item>
        <Menu.Item leftSection={<IconFolders size={16} />} onClick={() => navigate({ to: "/projects" })}>
          All projects…
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
```

`createProject()` changes `activeProjectId`, which remounts `AppStateProvider`; the navigation runs against the router, which is unaffected by the remount.

- [ ] **Step 2: Put it in the header**

In `src/components/Navigation.tsx`, replace the brand `<Link>` block (`:143-155`, from `{/* Logo and title …` through `</Link>`) with:

```tsx
          {/* Brand mark + active project. The product name lives in the mark's title and the About page. */}
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Link
              to="/overview"
              onClick={() => setActiveTab("overview")}
              title="OAE Metadata Builder"
              style={{ display: "flex", textDecoration: "none" }}
            >
              <Image src="/cts-logo.png" alt="OAE Metadata Builder" h={32} w="auto" />
            </Link>
            <ProjectSwitcher />
          </Group>
```

Add `import ProjectSwitcher from "@/components/ProjectSwitcher";`. Remove the now-unused `Text` import only if nothing else in the file uses it (it does: the menu label; keep it).

- [ ] **Step 3: Build, format, run tests**

Run: `bash -l -c 'mise exec -- npx biome check --write src/components'`, then `bash -l -c 'mise exec -- npm run build'`, then `bash -l -c 'mise exec -- npx vitest run'`
Expected: no lint errors, `✓ built`, tests pass

- [ ] **Step 4: Smoke it**

`npm run dev`: the header reads "Unnamed Project ▾" on first load; create a project and type a name in Research Project, and the header updates per keystroke. New project from the menu lands on `/project` with "Unnamed Project". Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectSwitcher.tsx src/components/Navigation.tsx
git commit -m "feat(nav): active project switcher replaces the brand text"
```

---

### Task 11: `/projects` page

**Files:**
- Create: `src/pages/projects/ProjectCard.tsx`, `src/pages/projects/ProjectsPage.tsx`, `src/routes/projects.tsx`

- [ ] **Step 1: Write the card**

```tsx
// src/pages/projects/ProjectCard.tsx
import { ActionIcon, Badge, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { formatRelativeTime } from "@/utils/relativeTime";
import type { ProjectSummary } from "@/workspace/WorkspaceContext";

interface ProjectCardProps {
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}

export default function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  return (
    <Card
      withBorder
      padding="md"
      radius="md"
      onClick={onOpen}
      role="button"
      aria-label={`Open ${project.name}`}
      style={{
        cursor: "pointer",
        borderColor: project.isActive ? "var(--mantine-color-coral-4)" : undefined,
        borderWidth: project.isActive ? 2 : 1,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600} truncate style={{ minWidth: 0 }}>
            {project.name}
          </Text>
          <Group gap={4} wrap="nowrap">
            {project.isActive && (
              <Badge size="xs" variant="light" color="coral">
                Active
              </Badge>
            )}
            <Tooltip label="Delete project">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Delete ${project.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Text size="xs" c="dimmed">
          {project.experimentCount} experiment{project.experimentCount === 1 ? "" : "s"} ·{" "}
          {project.datasetCount} dataset{project.datasetCount === 1 ? "" : "s"}
        </Text>
        <Text size="xs" c="dimmed">
          Edited {formatRelativeTime(project.updatedAt)}
        </Text>
      </Stack>
    </Card>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// src/pages/projects/ProjectsPage.tsx
import { Button, Container, Group, Modal, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { type ProjectSummary, useWorkspace } from "@/workspace/WorkspaceContext";
import ProjectCard from "./ProjectCard";

export default function ProjectsPage() {
  const { projects, switchProject, createProject, deleteProject } = useWorkspace();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);

  const openProject = (id: string) => {
    switchProject(id);
    navigate({ to: "/overview" });
  };

  const newProject = () => {
    createProject();
    navigate({ to: "/project" });
  };

  const confirmDelete = () => {
    if (pendingDelete) deleteProject(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <AppLayout>
      <Container size="lg" py="xl">
        <Stack gap="lg">
          <Group justify="space-between">
            <Title order={1}>Projects</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={newProject}>
              New project
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => openProject(project.id)}
                onDelete={() => setPendingDelete(project)}
              />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>

      <Modal opened={pendingDelete !== null} onClose={() => setPendingDelete(null)} title="Delete project">
        {pendingDelete && (
          <Stack>
            <Text size="sm">
              Delete <strong>{pendingDelete.name}</strong> and its {pendingDelete.experimentCount}{" "}
              experiment{pendingDelete.experimentCount === 1 ? "" : "s"} and {pendingDelete.datasetCount}{" "}
              dataset{pendingDelete.datasetCount === 1 ? "" : "s"}? This cannot be undone.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button color="red" onClick={confirmDelete}>
                Delete project
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </AppLayout>
  );
}
```

- [ ] **Step 3: Add the route**

```tsx
// src/routes/projects.tsx
import { createFileRoute } from "@tanstack/react-router";
import ProjectsPage from "@/pages/projects/ProjectsPage";

export const Route = createFileRoute("/projects")({ component: ProjectsPage });
```

- [ ] **Step 4: Build, format, run tests**

Run: `bash -l -c 'mise exec -- npx biome check --write src/pages/projects src/routes/projects.tsx'`, then `bash -l -c 'mise exec -- npm run build'`, then `bash -l -c 'mise exec -- npx vitest run'`
Expected: clean, `✓ built`, tests pass. The route tree is generated during the build.

- [ ] **Step 5: Smoke it**

`npm run dev`: from the switcher pick "All projects…". Cards render, the active one is outlined with an "Active" badge, clicking another lands on its overview, delete asks for confirmation and removes it. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/pages/projects src/routes/projects.tsx
git commit -m "feat(projects): projects page with switch, create, and delete"
```

---

### Task 12: Import as a new project

**Files:**
- Modify: `src/components/ImportPreviewModal.tsx:22-38` (props), `:288-296` (buttons)
- Modify: `src/components/Navigation.tsx:93-106` (`handleImport`) and `:287-297` (modal usage)

- [ ] **Step 1: Add the mode choice to the modal**

Add to `ImportPreviewModalProps`:

```ts
  importMode: "new" | "merge";
  onImportModeChange: (mode: "new" | "merge") => void;
```

Destructure both in the component, change `const hasBlockingError = duplicateExperimentIdError !== null;` to `const hasBlockingError = importMode === "merge" && duplicateExperimentIdError !== null;` (a fresh project has nothing to collide with), and replace the action buttons block with:

```tsx
        <Stack gap="sm">
          <SegmentedControl
            fullWidth
            value={importMode}
            onChange={(value) => onImportModeChange(value as "new" | "merge")}
            data={[
              { value: "new", label: "Add as a new project" },
              { value: "merge", label: "Merge into current project" },
            ]}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onImport} disabled={noneSelected || hasBlockingError}>
              Import {selectedCount} item{selectedCount !== 1 ? "s" : ""}
            </Button>
          </Group>
        </Stack>
```

Add `SegmentedControl` and `Stack` to the `@mantine/core` import if missing.

- [ ] **Step 2: Branch in `Navigation.tsx`**

Add near the other hooks: `const { importAsNewProject } = useWorkspace();` and `const [importMode, setImportMode] = useState<"new" | "merge">("new");` (import `useState`, and `import { useWorkspace } from "@/workspace/WorkspaceContext";`). Replace `handleImport` with:

```ts
  const handleImport = () => {
    const selected = importPreview.getSelectedItems();
    if (importMode === "new") {
      importAsNewProject(selected);
      navigate({ to: "/overview" });
    } else {
      importSelectedData(selected.project, selected.experiments, selected.datasets);
    }
    // On confirm, not on file selection: the preview can still be cancelled.
    trackEvent("metadata_import", {
      project: selected.project ? 1 : 0,
      experiments: selected.experiments.length,
      datasets: selected.datasets.length,
      mode: importMode,
    });
    importPreview.closePreview();
  };
```

and pass `importMode={importMode}` and `onImportModeChange={setImportMode}` to `<ImportPreviewModal … />`. Check `trackEvent`'s param type accepts a string value (`grep -n "export function trackEvent" -A3 src/utils/analytics.ts`); if it only accepts numbers, drop the `mode` field.

- [ ] **Step 3: Build, format, run tests**

Run: `bash -l -c 'mise exec -- npx biome check --write src/components'`, `bash -l -c 'mise exec -- npm run build'`, `bash -l -c 'mise exec -- npx vitest run'`
Expected: clean, `✓ built`, pass

- [ ] **Step 4: Smoke it**

`npm run dev`: import `e2e/fixtures/conditional-import.json` with "Add as a new project": a second project appears and is active. Import again with "Merge into current project": items land in the current one. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportPreviewModal.tsx src/components/Navigation.tsx
git commit -m "feat(import): choose between a new project and merging into the current one"
```

---

### Task 13: End-to-end spec

**Files:**
- Create: `e2e/projects.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// e2e/projects.spec.ts
import { createFromOverview, waitForRoute } from "./fixtures/app";
import { expect, test } from "./fixtures/test";

test.describe("Multiple projects", () => {
  test("names follow the form, switching changes the overview, deleting removes a project", async ({
    page,
  }) => {
    await page.goto("/overview");
    const switcher = page.getByRole("button", { name: /Current project:/ });
    await waitForRoute(switcher);
    await expect(switcher).toHaveText("Unnamed Project");

    // Naming the project updates the header as you type.
    await createFromOverview(page, "Project");
    await page.getByLabel(/Research Project/).fill("Kiel trial");
    await expect(switcher).toHaveText("Kiel trial");

    // A second project from the menu starts unnamed on the project form.
    await switcher.click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await expect(page).toHaveURL(/\/project$/);
    await expect(switcher).toHaveText("Unnamed Project");

    // Both are listed; opening the first lands on its overview.
    await switcher.click();
    await page.getByRole("menuitem", { name: /All projects/ }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(2);
    await page.getByRole("button", { name: "Open Kiel trial" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(switcher).toHaveText("Kiel trial");

    // Persists across a reload.
    await page.reload();
    await waitForRoute(switcher);
    await expect(switcher).toHaveText("Kiel trial");

    // Delete the unnamed one from the list.
    await page.goto("/projects");
    await page.getByRole("button", { name: "Delete Unnamed Project" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(1);
  });
});
```

If `getByLabel(/Research Project/)` matches more than one control, inspect the rendered form (`npx playwright codegen http://localhost:3000/project`) and tighten to the name input's label.

- [ ] **Step 2: Run it**

Run: `bash -l -c 'mise exec -- npx playwright test e2e/projects.spec.ts --reporter=list'`
Expected: 1 passed

- [ ] **Step 3: Run the whole e2e suite once**

Run: `CI=1 bash -l -c 'mise exec -- npx playwright test --reporter=line'`
Expected: all pass. The existing specs start on `/overview` with a fresh context, so the empty workspace behaves like the old empty session.

- [ ] **Step 4: Commit**

```bash
git add e2e/projects.spec.ts
git commit -m "test(e2e): multi-project switching, naming, persistence, and deletion"
```

---

### Task 14: Docs

**Files:**
- Create: `docs/multi-project.md`
- Modify: `CLAUDE.md` (the cross-cutting docs table under "Working in oae-form" or the repo's own table)

- [ ] **Step 1: Write the doc**

```markdown
# Multiple projects

A project is one `ProjectState`: project metadata plus its experiments and datasets. `WorkspaceProvider` (`src/workspace/WorkspaceContext.tsx`) holds the list, the active id, and persistence; `AppStateProvider` edits one project at a time and is remounted with `key={activeProjectId}` when the active project changes, so UI-only state resets on switch.

## Persistence

One localStorage key, `oae-metadata-builder-workspace`, holds the whole `Workspace` (`src/workspace/types.ts`). Saves are debounced 2 s. On first load, a pre-workspace `oae-metadata-builder-session` entry is migrated into the first project and removed. `WorkspaceStore` (`src/workspace/storage.ts`) is the interface a cloud implementation replaces.

## Names and ids

The display name is derived from `projectData.name`, falling back to "Unnamed Project"; nothing stores it. Ids are `crypto.randomUUID()`; `updatedAt` changes whenever a project's state changes.

## Shared pure functions

`parseProjectState` (`src/utils/parseProjectState.ts`) parses and migrates a persisted project at the boundary. `applyImport` (`src/utils/applyImport.ts`) merges an import selection into a project; both the in-place import and "Add as a new project" use it. Links to experiments in the current project are dropped when importing as a new project.
```

- [ ] **Step 2: Reference it from `CLAUDE.md`**

Add a row to the docs table: `| [`docs/multi-project.md`](docs/multi-project.md) | Touching workspace persistence, project switching, or the AppStateProvider lifecycle |`.

- [ ] **Step 3: Commit**

```bash
git add docs/multi-project.md CLAUDE.md
git commit -m "docs: multi-project workspace pattern"
```

---

### Task 15: Final checks and PR

- [ ] **Step 1: Full verification**

```bash
bash -l -c 'mise exec -- npm run check'
bash -l -c 'mise exec -- npm run build'
bash -l -c 'mise exec -- npx vitest run'
CI=1 bash -l -c 'mise exec -- npx playwright test --reporter=line'
```

Expected: no lint errors, `✓ built`, unit and e2e green.

- [ ] **Step 2: Header treatments for design review**

With the dev server running, capture the header at 1440 px width in the built state (option 1), then two throwaway variations made by editing `Navigation.tsx` locally and reverting: option 2 (brand text small and dimmed above the switcher) and option 3 (two-row header). Save as `docs/superpowers/specs/header-option-{1,2,3}.png` in the scratchpad, not the repo. Revert any local edits before the next step (`git checkout -- src/components/Navigation.tsx`).

- [ ] **Step 3: Open the PR**

```bash
git push -u origin feat/multi-project
gh pr create --base dev --title "feat: multiple local projects with a header switcher and projects page" --body "$(cat <<'EOF'
Adds a workspace of projects persisted in localStorage, with the active project switchable from a header dropdown and managed on a new /projects page. AppStateProvider now edits one project at a time (initialState / onChange, remounted per active project); the single-session autosave and restore modal are replaced, with a one-time migration of the old key. Import gains an "Add as a new project" option. No cloud sync; the WorkspaceStore interface is the seam for it.
EOF
)"
```

---

## Self-review

- Spec coverage: model (T1), storage and migration (T3), providers and remount (T6, T7, T8), header (T10), `/projects` with Active badge, switch, delete, new (T11), import choice (T12), overview unchanged (no task needed), live name (T10 via `useAppState`), tests (T1–T7, T13), docs (T14), header alternates (T15). The spec mentioned organization on cards; `DraftProject` has no organization field, so cards show name and counts only. Spec updated to match.
- Placeholders: the moved reducer body in T5 is referenced by exact line range rather than re-quoted, which is a move, not a placeholder.
- Type consistency: `ImportSelection` (T5) is what `getSelectedItems()` returns (T12) and what `importAsNewProject` takes (T7). `ProjectSummary` (T7) is what `ProjectCard` renders (T11). `projectDisplayName` (T1) is used in T7 and T10.
