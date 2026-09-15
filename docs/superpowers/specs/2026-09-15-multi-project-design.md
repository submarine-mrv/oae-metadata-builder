# Multi-project support (local, no login)

Branch `feat/multi-project` off `dev`. Gives the metadata builder a list of projects the user can switch between, persisted locally, with a shape a later cloud-sync PR can pick up without reworking state.

## Model

A project is what the whole app state is today: one OAEProject plus its experiments and datasets. The user has several and works in one at a time. Switching swaps the entire builder.

```ts
// src/workspace/types.ts
export interface ProjectState {          // what one project owns; today's SavedSession minus savedAt
  hasProject: boolean;
  projectData: DraftProject;
  experiments: ExperimentState[];
  datasets: DatasetState[];
  nextExperimentId: number;
  nextDatasetId: number;
}
export interface ProjectRecord { id: string; createdAt: number; updatedAt: number; state: ProjectState }
export interface Workspace     { version: 1; activeProjectId: string; projects: ProjectRecord[] }
```

- `id` is a client-generated UUID (`crypto.randomUUID()`), so cloud rows can key on it later.
- The display name is derived, never stored: `projectData.name` trimmed, else `Unnamed Project`.
- `updatedAt` changes whenever the project's `ProjectState` changes; it drives "Edited …" on cards and gives sync a cheap change marker.

## Storage

`src/workspace/storage.ts` exposes a `WorkspaceStore` interface (`load(): Workspace | null`, `save(workspace)`) with one localStorage implementation under the key `oae-metadata-builder-workspace`. Saves are debounced 2 s, as the session autosave is today. Loads validate shape and fall back to an empty workspace on anything malformed.

Migration: on first load with no workspace, if the legacy `oae-metadata-builder-session` key holds a valid saved session, it becomes the first project (its `savedAt` becomes `createdAt` and `updatedAt`) and the legacy key is removed. No expiry; projects stay until deleted.

## Providers

`src/workspace/WorkspaceContext.tsx` provides `WorkspaceProvider` and `useWorkspace()`:

- `projects: ProjectSummary[]` (id, name, experimentCount, datasetCount, updatedAt, isActive), newest first.
- `activeProjectId`, `activeProject: ProjectRecord`.
- `createProject(): string` — new record with `hasProject: true` and empty `projectData`, made active.
- `switchProject(id)`.
- `deleteProject(id)` — if it was active, the most recently edited remaining project becomes active; if none remain, a fresh Unnamed Project is created.
- `importAsNewProject(selection)` — builds a `ProjectState` from an import selection using the same pure function the in-place import uses, then creates and activates the record.
- `updateActiveProject(state: ProjectState)` — called by `AppStateProvider`; sets `updatedAt` and schedules a save.

`AppStateProvider` gains two props: `initialState?: ProjectState` and `onChange?: (state: ProjectState) => void`. Initial state runs through the same parse/migrate path `restoreFullState` uses today (extracted into a pure `parseProjectState`). `onChange` fires from an effect on the persisted subset of state, skipping the mount. `App.tsx` mounts `<AppStateProvider key={activeProjectId} initialState={activeProject.state} onChange={updateActiveProject}>`, so switching projects remounts the builder with that project's data. UI-only state (active tab, JSON preview toggle) resets on switch.

The import reducer body in `importSelectedData` is extracted to a pure `applyImport(prev: ProjectState, selection): ProjectState` so both the in-place import and `importAsNewProject` share it.

Retired: `SessionManager`, `SessionRestoreModal`, `useSessionPersistence`. Nothing else references them.

## UI

**Header.** Logo mark, then the active project's name as a dropdown (`Unnamed Project ▾` until named), then the section tabs, then actions. The "OAE Metadata Builder" text leaves the header (it stays in the mark's tooltip, the About page and the document title). The dropdown lists projects with the active one checked, then "New project" (creates one and navigates to `/project`) and "All projects…" (navigates to `/projects`). Shown on every page, logged in or not.

**`/projects` page.** Heading "Projects". A card grid: name, experiment and dataset counts, "Edited …" relative time, an "Active" badge on the current project. Clicking a card switches to it and navigates to `/overview`. Each card has a delete icon that opens a confirm modal naming the project and its counts. A "New project" button matches the dropdown's.

**Overview.** Unchanged. Its "Create Project" card still creates project metadata inside the active project.

**Project form.** Unchanged; because `updateProjectData` runs on every change, the header name follows the Research Project name as it's typed.

**Import.** The import preview gains a segmented choice above the action buttons: "Add as a new project" (default) or "Merge into current project". Export is unchanged and scoped to the active project.

## Tests

- Unit: `storage` (round trip, validation, legacy migration, malformed input), workspace actions (create/switch/delete/import, active fallback on delete), name derivation, `parseProjectState`, `applyImport` (moved, existing behaviour kept).
- Existing unit suite must stay green; no test touches the retired session modules.
- E2E: one new spec: create a project and name it, see the header update, create a second from the dropdown, switch from `/projects`, confirm the overview shows the right project, delete one. Existing specs run unchanged; the "restore" spec is about RJSF field restore, not the session modal.

## Out of scope

Cloud sync, sharing, ownership, sorting or search on the projects page, renaming from the list, per-project settings. The header treatment ships as option 1 above; two alternates are delivered as screenshots for design review, not as code.
