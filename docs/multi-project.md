# Multiple projects

## Model

A workspace holds a list of projects and the id of the active one. A project is one `ProjectState`: project metadata plus its experiments and datasets. The pure transitions (add, switch, delete, update) live in `src/workspace/workspace.ts`.

| Layer | Types | Holds |
|---|---|---|
| Schema content | `DraftProject`, `DraftExperiment`, `DraftDataset` | Exported metadata; output of the `parse*` functions |
| Entity records | `ExperimentRecord`, `DatasetRecord` | Internal id, display name, timestamps, linking, and `formData` holding a `Draft*` |
| Project | `ProjectRecord`, whose `state` is a `ProjectState` | `projectData`, the records and the id counters; the unit that is saved |

## State

State lives in Jotai atoms in `src/state/`. `workspaceAtom` holds the one copy of every project. `projectStateAtom` reads the active project and writes back to it; with no active project, writes do nothing. Action atoms in `actions.ts` wrap the pure reducers in `projectReducers.ts`, so id propagation and cleanup happen in one place. Components read narrow atoms (`projectNameAtom`, `projectMenuAtom`, `experimentsAtom`) and `useExperiment(id)` / `useDataset(id)` from `hooks.ts`, and call actions with `useSetAtom`, so unrelated edits don't re-render them.

A project opens with its first experiment and first dataset selected. The project, experiment and dataset forms are bound to the store: each takes `formData` from its record and writes every change back through an action, after running it through the entity's `parse*` function. `__root.tsx` keys the routed page on the active project id, so page-local UI state such as an open error list starts fresh after a switch.

`hydrate` in `store.ts` loads the saved workspace at startup and runs each project through `parseProjectState` (`src/utils/parseProjectState.ts`), which parses and migrates old data.

## Empty workspace and routing

Zero projects is a legal state: first run, and after the last project is deleted. `activeProjectId` is then `null`.

`/overview` renders `WelcomePage` (`src/pages/welcome/`) with two actions: "Create your first project" and "Import from file". `RequireProject` (`src/workspace/RequireProject.tsx`) wraps `/project`, `/experiment`, `/dataset` and `/projects`. With no projects it redirects to `/overview` with `replace`, so Back doesn't return to the empty route.

Creating a project, from anywhere, lands on `/project`.

## Header and /projects

While the workspace is empty, the header shows the brand, Import and the menu. Once a project exists it adds the project crumb, the section tabs and Export. Below 1280px the tabs move to a second row, and at 768px and below Import and Export move into the menu.

The crumb is `ProjectSwitcher` (`src/components/ProjectSwitcher.tsx`). Its menu lists every project, then "New project" and "All projects…". `/projects` (`src/pages/projects/`) shows one card per project, newest edit first, with counts, the last edit and an "Active" badge. Picking a project from either opens its `/overview`, whose H1 is the project name.

## Deleting

You delete a whole project from its `/projects` card or the overview. `DeleteProjectModal` confirms first. Deleting the active project activates the most recently edited one left. Deleting the last one returns to the empty workspace. There is no action that clears a project's metadata in place.

## Persistence

One localStorage key, `oae-metadata-builder-workspace`, holds the whole `Workspace`. `WorkspaceStore` (`src/workspace/storage.ts`) is the interface a cloud store would replace. `startPersistence` (`src/state/persistence.ts`) subscribes to `workspaceAtom`. Edits save after a 2 s debounce. Create, delete, switch and import save at once. A pending edit is flushed on `pagehide` and when the page becomes hidden.

Loading keeps whatever it can read:

- A project record that fails validation is dropped and the rest load. The raw data is first copied to `oae-metadata-builder-workspace-backup-<timestamp>`.
- A missing or dangling active id is repaired to the most recently edited project.
- Data that won't parse, or has an unknown `version`, is backed up under the same prefix and the app starts empty.
- A pre-workspace `oae-metadata-builder-session` entry becomes the first project.

Backups are never deleted. If storage is full the backup can fail. Dropped records are then quarantined: every save writes them back, and each load retries the backup.

## Open tabs

Each tab keeps its own copy of the workspace and saves the whole of it, so two open tabs overwrite each other's changes. See `docs/multi-tab-editing.md` for the options under review.

## Names, ids and titles

The display name is the Research Project field, or "Unnamed Project" when it is empty. Nothing stores it. Project ids are `crypto.randomUUID()`. `updatedAt` changes whenever a project's state changes.

`DocumentTitle` sets the tab title on every route: "Kiel trial · OAE Metadata Builder" once the project is named, "OAE Metadata Builder" otherwise.

Analytics (`src/utils/analytics.ts`) sets a fixed `page_title` per route with `gtag("set")`, so GA never sees the project name from `document.title`.

## Import

`useImportFlow` (`src/hooks/useImportFlow.ts`) owns the file picker, preview and confirm, for the header and the welcome screen.

The preview offers two modes: "Add as a new project" and "Merge into current project". Merge appears only when a project exists. Both open `/overview` afterwards.

`useImportPreview` compares the file against a baseline. A new project resolves against an empty baseline, so nothing conflicts and datasets link only to experiments in the file. Merge resolves against the current project: imported project fields override existing ones, an experiment with a matching `experiment_id` is replaced, and datasets are always added. Switching mode re-analyzes the file with `rebase` and keeps ticked items.

A file with duplicate experiment ids is blocked in both modes.

`applyImport` (`src/utils/applyImport.ts`) builds the result for both modes. It drops a dataset link whose experiment isn't in the result. `getSelectedItems` renumbers dataset links to match the ticked experiments. A dataset linked to an unticked experiment imports unlinked.

The app owns `project_id` and `experiment_id` on imported records and ignores the file's values.

