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

`ProjectPersistenceController` chooses the persistence lifecycle after auth resolves. For guests, `hydrate` in `store.ts` loads the saved workspace and runs each project through `parseProjectState` (`src/utils/parseProjectState.ts`), which parses and migrates old data. Authenticated sessions load private cloud projects instead; see [private project cloud sync](./workspace-cloud-sync.md).

## Empty workspace and routing

Zero projects is a legal state: first run, and after the last project is deleted. `activeProjectId` is also `null` while viewing All projects, without deleting any project.

With an empty workspace, `/overview` renders `WelcomePage` (`src/pages/welcome/`). `RequireProject` (`src/workspace/RequireProject.tsx`) wraps `/project`, `/experiment` and `/dataset`, redirecting to `/projects` when projects exist but none is selected, or `/overview` when empty. `/projects` needs no selection but also redirects to `/overview` when empty.

Creating a project, from anywhere, lands on its metadata form, `/projects/<project>/metadata`.

## URLs

Each project page has its own URL (issue [#192](https://github.com/submarine-mrv/oae-data-commons/issues/192)):

| Page | URL |
| --- | --- |
| Overview | `/projects/<project>` |
| Project metadata form | `/projects/<project>/metadata` |
| Experiment | `/projects/<project>/experiments/<experiment>` |
| Dataset | `/projects/<project>/datasets/<dataset>` |

The slugs come from `src/workspace/slugs.ts`. A project or experiment uses its human ID (`project_id`, `experiment_id`, trimmed) when no other project, or no other experiment in the project, has the same one; otherwise, or while it is empty, its internal ID. Datasets have no human ID and always use the internal one. Slugs are percent-encoded, so IDs with `/`, `#` or spaces work.

Nothing is fetched by slug. Every project the user can open is already in the workspace (one `list_metadata_builder_projects` call when signed in, `localStorage` for guests), and `ProjectPersistenceController` holds the routes until it is, so the routes in `src/workspace/EntityRoutes.tsx` resolve slugs synchronously:

- `ProjectRoute`, the `/projects/$projectId` layout, matches the internal ID first, then the human ID. It makes the project active, then renders the page, so a page never shows the previously active project. `ExperimentRoute` and `DatasetRoute` select their record the same way.
- A URL that isn't canonical, such as an internal ID for a project with a unique human ID, is replaced with the canonical one. Editing a human ID moves the URL with it: `useSlugResolution` keeps resolving the old slug to the same record until the URL catches up.
- Human IDs are unique only among published projects, so a slug can match several drafts. That shows `AmbiguousIdPage`, which lists the matches (with owner and last edit) and never picks one; choosing opens it by internal ID.
- No match shows `NotFoundPage`: "Project ID "X" can't be found", or the experiment or dataset equivalent with a link back to the project. It doesn't say whether a project exists that you can't open. Unknown paths get the generic "Page not found".
- Guests with auth enabled also get Sign in, which returns to the link.

Code navigates with `useEntityNavigate` (`src/workspace/useEntityNavigate.ts`), which builds the slug URL from the store when called, so it can follow an action in the same handler. `useCurrentEntityPage` reports which project page is showing, for the tabs.

The pre-slug paths `/overview`, `/project`, `/experiment` and `/dataset` still work: `ActivePageRedirect` replaces them with the active project's URL, and `/overview` stays the welcome screen while the workspace is empty.

Signed-in users get "Copy link to this page" in the menu and "Copy link" in the Share dialog (`useCopyLink`). The link uses the same slugs as the address bar. Guest projects live in one browser, so guests get neither.

## Header and /projects

While the workspace is empty, the header shows the brand, Import and the menu. Once a project exists it adds the project crumb, the section tabs and Export. Below 1280px the tabs move to a second row, and at 768px and below Import and Export move into the menu.

The crumb is `ProjectSwitcher` (`src/components/ProjectSwitcher.tsx`). Its menu lists every project, then "New project" and "All projects…". Entering `/projects` clears the selection and hides project tabs and Export. Picking a project opens its overview, `/projects/<project>`, whose H1 is the project name.

## Deleting

You delete a whole project from its `/projects` card or the overview. For a shared cloud project only the owner sees delete; the card shows "Shared by" the owner for everyone else. `DeleteProjectModal` confirms first. Deleting the open project goes to All projects, as does a project deleted in another tab while open. Deleting the last one returns to the empty workspace. There is no action that clears a project's metadata in place. The restore prompt's Start fresh deletes every project at once.

## Restore prompt

`RestorePrompt` (`src/components/RestorePrompt.tsx`) runs for guests on the first load of a tab. With saved projects it offers Restore session or Start fresh. Start fresh asks to confirm, then `deleteAllProjectsAtom` empties the workspace, which saves at once, and the welcome screen shows. A `sessionStorage` key marks the tab as asked, so reloads in the same tab don't ask again; a new tab does. A reload that leaves the prompt unanswered asks again.

## Guest persistence

One localStorage key, `oae-metadata-builder-workspace`, holds the guest `Workspace`. `startPersistence` (`src/state/persistence.ts`) subscribes to `workspaceAtom` only in guest mode. Edits save after a 2 s debounce. Create, delete, switch and import save at once. A pending edit is flushed on `pagehide`, when the page becomes hidden, and before leaving the guest persistence lifecycle.

Authenticated editing instead synchronizes changed project records directly from Jotai to private Supabase sessions, without local project snapshots. Existing local projects are offered through an explicit migration action. See [private project cloud sync](./workspace-cloud-sync.md) for conditional saves, account isolation and memory-only offline limitations.

Loading keeps whatever it can read:

- A project record that fails validation is dropped and the rest load. The raw data is first copied to `oae-metadata-builder-workspace-backup-<timestamp>`.
- A missing or dangling active id is repaired to the most recently edited project.
- Data that won't parse, or has an unknown `version`, is backed up under the same prefix and the app starts empty.
- A pre-workspace `oae-metadata-builder-session` entry becomes the first project.

Backups are never deleted. If storage is full the backup can fail. Dropped records are then quarantined: every save writes them back, and each load retries the backup.

## Open tabs

In guest mode, each tab keeps its own copy of the workspace and saves the whole of it, so two open tabs overwrite each other's changes. See `docs/multi-tab-editing.md` for the details and the alternatives. Authenticated sessions use per-project conditional cloud saves with conflict reconciliation instead.

## Names, ids and titles

The display name is the Project Name field (`projectData.name`), falling back to "Unnamed Project" when it is empty or not text. Nothing stores it. Project ids are `crypto.randomUUID()`. `updatedAt` changes whenever a project's state changes.

`DocumentTitle` sets the tab title on every route: "Kiel trial · OAE Metadata Builder" once the project is named, "OAE Metadata Builder" otherwise.

Analytics (`src/utils/analytics.ts`) sets a fixed `page_title` per route with `gtag("set")`, so GA never sees the project name from `document.title`.

## Import

`useImportFlow` (`src/hooks/useImportFlow.ts`) owns the file picker, preview and confirm, for the header and the welcome screen.

The preview offers two modes: "Add as a new project" and "Merge into current project". Merge appears only when a project is selected. Both open the project's overview afterwards.

`useImportPreview` compares the file against a baseline. A new project resolves against an empty baseline, so nothing conflicts and datasets link only to experiments in the file. Merge resolves against the current project: imported project fields override existing ones, an experiment with a matching `experiment_id` is replaced, and datasets are always added. Switching mode re-analyzes the file with `rebase` and keeps ticked items.

A file with duplicate experiment ids is blocked in both modes.

`applyImport` (`src/utils/applyImport.ts`) builds the result for both modes. It drops a dataset link whose experiment isn't in the result. `getSelectedItems` renumbers dataset links to match the ticked experiments. A dataset linked to an unticked experiment imports unlinked.

The app owns `project_id` on imported records and ignores the file's value. An imported experiment keeps its `experiment_id`, and a dataset takes its `experiment_id` from the experiment it links to. Experiments match on `experiment_id` only: one with no `experiment_id`, or with the same name as an existing experiment, is added as new.

`localStorageWorkspaceStore.load` runs `migrateProject`, `migrateExperiment` and `migrateDataset` (`src/utils/migrations.ts`) on every stored project and saves the result, so the project list shows current field names. `hydrate` then parses and migrates each project again through `parseProjectState`.
