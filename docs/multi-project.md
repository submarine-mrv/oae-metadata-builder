# Multiple projects

## Model

A workspace holds a list of projects and the id of the active one. A project is one `ProjectState`: project metadata plus its experiments and datasets.

`WorkspaceProvider` (`src/workspace/WorkspaceContext.tsx`) owns the list, the active id and persistence. `AppStateProvider` (`src/contexts/AppStateContext.tsx`) edits the open project. `ActiveProjectSession` in `src/App.tsx` mounts it with `key={activeProjectId}`, so switching projects remounts it and resets UI-only state. A project opens with its first experiment and first dataset selected. Each edit goes back to the project that made it through `updateProject(id, state)`; an unknown id is ignored.

The pure transitions (add, switch, delete, update) live in `src/workspace/workspace.ts`.

| Layer | Types | Holds |
|---|---|---|
| Schema content | `DraftProject`, `DraftExperiment`, `DraftDataset` | Exported metadata; output of the `parse*` functions |
| Entity records | `ExperimentRecord`, `DatasetRecord` | Internal id, display name, timestamps, linking, and `formData` holding a `Draft*` |
| Project | `ProjectRecord`, whose `state` is a `ProjectState` | `projectData`, the records and the id counters; the unit that is saved |

## Empty workspace and routing

Zero projects is a legal state: first run, and after the last project is deleted. `activeProjectId` is then `null`, and `AppStateProvider` mounts with a blank state whose edits go nowhere.

`/overview` renders `WelcomePage` (`src/pages/welcome/`) with two actions: "Create your first project" and "Import from file". `RequireProject` (`src/workspace/RequireProject.tsx`) wraps `/project`, `/experiment`, `/dataset` and `/projects`. With no projects it redirects to `/overview` with `replace`, so Back doesn't return to the empty route.

Creating a project, from anywhere, lands on `/project`.

## Header and /projects

While the workspace is empty, the header shows the brand, Import and the menu. Once a project exists it adds the project crumb, the section tabs and Export. From 1280px the tabs sit centred in the top row. Below that they move to a full-width second row so the crumb keeps its width, and at 768px and below the brand text is hidden and Import and Export move into the menu.

The crumb is `ProjectSwitcher` (`src/components/ProjectSwitcher.tsx`): "OAE Metadata Builder / Kiel trial ▾". Its menu lists every project with a check on the active one, then "New project" and "All projects…". Picking a project switches to it and opens `/overview`.

`/projects` (`src/pages/projects/`) shows one card per project, newest edit first, with experiment and dataset counts, the time of the last edit and an "Active" badge on the open one. A card opens its project on `/overview`. "New project" creates one.

The overview's H1 is always the project name, with "Overview" beneath it. The project card there is headed "Project Metadata".

## Deleting

You delete a whole project, from its `/projects` card or the overview's project card. `DeleteProjectModal` confirms first and names the experiment and dataset counts. Deleting the active project activates the most recently edited one left. Deleting the last one returns to the empty workspace. There is no action that clears a project's metadata in place.

## Persistence

One localStorage key, `oae-metadata-builder-workspace`, holds the whole `Workspace` (`src/workspace/types.ts`). `WorkspaceStore` (`src/workspace/storage.ts`) is the interface a cloud store would replace.

Edits save after a 2 s debounce. Create, delete, switch and import save at once. A pending edit is flushed on `pagehide` and when the page becomes hidden. Saved projects don't expire.

Loading keeps whatever it can read:

- A project record that fails validation is dropped and the rest load. The raw data is first copied to `oae-metadata-builder-workspace-backup-<timestamp>`.
- A missing or dangling active id is repaired to the most recently edited project.
- Data that won't parse, or has an unknown `version`, is backed up under the same prefix and the app starts empty.
- A pre-workspace `oae-metadata-builder-session` entry becomes the first project. The old key is removed only after the new workspace is written.

Backups are never deleted. If storage is full the backup can fail. Dropped project records are then quarantined: every save writes them back after the readable projects, and each load retries the backup, clearing the quarantine once it succeeds. An unreadable envelope stays in place until the next save overwrites it.

## Known limitation

Two open tabs overwrite each other. Each tab saves its own copy of the workspace, so a project created in one tab disappears when the other saves. The fix is planned with the move of builder state to Jotai.

## Names, ids and titles

The display name is the Research Project field (`projectData.research_project`), falling back to "Unnamed Project" when it is empty or not text. Nothing stores it. Project ids are `crypto.randomUUID()`. `updatedAt` changes whenever a project's state changes.

`DocumentTitle` sets the tab title on every route: "Kiel trial · OAE Metadata Builder" once the project is named, "OAE Metadata Builder" otherwise.

Analytics (`src/utils/analytics.ts`) sends a fixed `page_title` per route, such as "Overview" or "Projects". It never sends the project name.

## Import

`useImportFlow` (`src/hooks/useImportFlow.ts`) owns the file picker, preview and confirm. `ImportFlow` renders its input and modal. The header and the welcome screen both use it.

The preview offers two modes: "Add as a new project" and "Merge into current project". Merge appears only when a project exists. Both modes open `/overview` after importing, since an open experiment or dataset page would keep showing its pre-import form data.

`useImportPreview` compares the file against a baseline. A new project resolves against an empty baseline, so nothing conflicts and datasets link only to experiments in the file. Merge resolves against the current project: imported project fields override existing ones, an experiment with a matching `experiment_id` is replaced, and datasets are always added. Switching mode re-analyzes the file with `rebase`, keeping ticked items and links to experiments in the file.

A file with duplicate experiment ids is blocked in both modes.

`applyImport` (`src/utils/applyImport.ts`) builds the result for both modes. It drops a dataset link whose experiment isn't in the result. `getSelectedItems` renumbers dataset links to match the ticked experiments. A dataset linked to an unticked experiment imports unlinked and keeps the file's `experiment_id`.

`parseProjectState` (`src/utils/parseProjectState.ts`) parses and migrates a saved project when `AppStateProvider` loads it.
