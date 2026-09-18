# Multiple projects

A project is one `ProjectState`: project metadata plus its experiments and datasets. `WorkspaceProvider` (`src/workspace/WorkspaceContext.tsx`) holds the list, the active id, and persistence; `AppStateProvider` edits one project at a time and is remounted with `key={activeProjectId}` when the active project changes, so UI-only state resets on switch.

## Empty workspace

Zero projects is a legal state: first run, and after the last project is deleted. `activeProjectId` is then `null` and `AppStateProvider` mounts with a blank state whose changes go nowhere. `/overview` renders `WelcomePage` (`src/pages/welcome/`), whose actions are "Create your first project" and "Import from file". The `/project`, `/experiment`, `/dataset` and `/projects` routes are wrapped in `RequireProject` (`src/workspace/RequireProject.tsx`), which redirects to `/overview`, so deleting the last project from the list lands on the welcome screen. The header shows the brand, Import and the menu only.

Creating a project, from anywhere, lands on `/project`.

## Deleting

A project is deleted as a whole, from the `/projects` card or the overview's project card, through `DeleteProjectModal`. Deleting the active project activates the most recently edited remaining one; deleting the last returns to the empty workspace. There is no in-project "clear metadata" action.

## Persistence

One localStorage key, `oae-metadata-builder-workspace`, holds the whole `Workspace` (`src/workspace/types.ts`). Saves are debounced 2 s and flushed on `pagehide`. On first load, a pre-workspace `oae-metadata-builder-session` entry is migrated into the first project and removed. `WorkspaceStore` (`src/workspace/storage.ts`) is the interface a cloud implementation replaces.

## Names and ids

The display name is the Research Project field (`projectData.research_project`), falling back to "Unnamed Project"; nothing stores it. It appears in the header crumb whenever a project exists, in the tab title once the project is named, and as the overview heading with two or more projects. Ids are `crypto.randomUUID()`; `updatedAt` changes whenever a project's state changes.

## Import

`useImportFlow` (`src/hooks/useImportFlow.ts`) owns the file picker, preview and confirm; `ImportFlow` renders its input and modal. The header and the welcome screen both use it. "Merge into current project" is offered only when a project exists.

## Shared pure functions

`parseProjectState` (`src/utils/parseProjectState.ts`) parses and migrates a persisted project at the boundary. `applyImport` (`src/utils/applyImport.ts`) merges an import selection into a project; both the in-place import and "Add as a new project" use it. Links to experiments in the current project are dropped when importing as a new project.
