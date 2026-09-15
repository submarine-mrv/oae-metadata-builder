# Multiple projects

A project is one `ProjectState`: project metadata plus its experiments and datasets. `WorkspaceProvider` (`src/workspace/WorkspaceContext.tsx`) holds the list, the active id, and persistence; `AppStateProvider` edits one project at a time and is remounted with `key={activeProjectId}` when the active project changes, so UI-only state resets on switch.

## Persistence

One localStorage key, `oae-metadata-builder-workspace`, holds the whole `Workspace` (`src/workspace/types.ts`). Saves are debounced 2 s. On first load, a pre-workspace `oae-metadata-builder-session` entry is migrated into the first project and removed. `WorkspaceStore` (`src/workspace/storage.ts`) is the interface a cloud implementation replaces.

## Names and ids

The display name is derived from `projectData.name`, falling back to "Unnamed Project"; nothing stores it. Ids are `crypto.randomUUID()`; `updatedAt` changes whenever a project's state changes.

## Shared pure functions

`parseProjectState` (`src/utils/parseProjectState.ts`) parses and migrates a persisted project at the boundary. `applyImport` (`src/utils/applyImport.ts`) merges an import selection into a project; both the in-place import and "Add as a new project" use it. Links to experiments in the current project are dropped when importing as a new project.
