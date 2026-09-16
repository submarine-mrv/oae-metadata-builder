# First run and the empty workspace

Follow-up to `2026-09-15-multi-project-design.md`, on `feat/multi-project`. Makes zero projects a legal state, replaces the auto-created "Unnamed Project" with a welcome screen, and fixes the loop where deleting the last project on `/projects` recreated it in place. Also carries three small header and overview changes agreed in the same review.

## Decisions

- Zero projects is legal. First run and delete-last both land on a welcome screen whose primary action is creating a project.
- Creating a project always lands on the project metadata form, from the welcome screen, the switcher and the projects page alike.
- The overview's project-card trash icon deletes the whole project. The in-project "clear project metadata and unlink" action goes away.

## Model

```ts
export interface Workspace {
  version: 1;
  activeProjectId: string | null;   // null when projects is empty
  projects: ProjectRecord[];
}
```

- `emptyWorkspace()` returns `{ version: 1, activeProjectId: null, projects: [] }`.
- `deleteProject` on the last project returns the empty workspace. Deleting the active one among several activates the most recently edited remaining project, as before.
- `activeProject(workspace)` returns `ProjectRecord | null`.
- The storage validator accepts a null active id and an empty list. Legacy-session migration is unchanged: a saved session becomes the first project.
- `hasProject` stays in `ProjectState`. Every workspace-created project has it true, so the overview's dashed "Create Project" card only appears for a migrated session that had experiments but no project metadata.

## Shell and routing

`ActiveProjectSession` in `App.tsx` keeps `AppStateProvider` mounted whether or not a project exists, keyed on the active id or `"empty"`, with `emptyProjectState()` as the initial state and no `onChange` when empty. Pages and hooks keep working unchanged.

`useWorkspace()` exposes `activeProjectId: string | null`, `activeProject: ProjectRecord | null` and the existing `projects` list. `updateActiveProject` is a no-op when there is no active project.

Route behaviour when the workspace is empty:

| Route | Behaviour |
|---|---|
| `/overview` | Renders `WelcomePage` instead of `OverviewPage` |
| `/project`, `/experiment`, `/dataset` | `RequireProject` wrapper redirects to `/overview` |
| `/projects` | Renders its empty state |
| `/about`, `/how-to`, `/checker` | Unchanged |

`RequireProject` lives in `src/workspace/RequireProject.tsx` and renders `<Navigate to="/overview" />` when `projects.length === 0`, otherwise its children.

## Welcome screen

`src/pages/welcome/WelcomePage.tsx`, inside `AppLayout`.

```
┌────────────────────────────────────────────────────────────────┐
│ [mark] OAE Metadata Builder                        Import  ⋮   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Welcome to the OAE Metadata Builder                          │
│   Manage metadata for OAE projects, experiments and datasets   │
│   in compliance with the OAE Data Management Protocol.         │
│   Beta notice, contact address, About link.                    │
│                                                                │
│   [ + Create your first project ]   [ Import from file ]       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- The text is the overview's current beta alert, moved verbatim. The overview no longer shows the alert.
- "Create your first project" calls `createProject()` and navigates to `/project`.
- "Import from file" opens the same import flow as the header.

## Import flow shared between header and welcome screen

The hidden file input, the `useImportPreview` wiring, the import handlers and `ImportPreviewModal` move out of `Navigation` into:

- `src/hooks/useImportFlow.ts`: returns `{ openFilePicker, inputProps, previewProps }` and owns the mode state (`"new" | "merge"`), the analytics event and the `importAsNewProject` / `importSelectedData` dispatch.
- `src/components/ImportFlow.tsx`: renders the hidden `<input type="file">` and `ImportPreviewModal` from those props.

`Navigation` and `WelcomePage` each call the hook and render `ImportFlow`. When the workspace is empty the preview hides the new/merge control and always creates a new project.

## Header when the workspace is empty

Brand mark and text only. Hidden: the project switcher, the section tabs, and Export (desktop button and mobile menu item). Import and the ⋮ menu stay. This is criterion 6 in `notes/design/ux-criteria.md`: the header reads as it always has and still offers the way to start.

## Projects page when empty

The heading and "New project" button stay. The card grid is replaced by one dashed card reading "No projects yet" with a "Create project" button that behaves like "New project". Deleting the last project from this page stays on the page and shows this card.

## Deleting a project from the overview

The project card's trash icon opens the confirm modal the projects page uses, extracted to `src/pages/projects/DeleteProjectModal.tsx` (props: `project: ProjectSummary | null`, `onConfirm`, `onCancel`). Confirm calls the workspace `deleteProject(activeProjectId)`. The route stays `/overview`, which re-renders as the next most recent project or the welcome screen.

`AppStateContext.deleteProject` is removed along with its unit tests. The `propagateProjectIdTo…` helpers stay; `updateProjectData` still uses them.

## Small header and overview changes

- **Document title.** `AppLayout` sets it with Mantine's `useDocumentTitle`: `<name> · OAE Metadata Builder` when the active project has a Research Project name, `OAE Metadata Builder` otherwise. Applies with one project as well as several; the title is not a control, so the crumb's two-project rule does not apply.
- **Overview heading.** With two or more projects the H1 is the project name with a dimmed "Overview" line beneath it. With one project it stays "OAE Metadata Builder – Overview".
- **Mobile brand.** Below 768px the brand text is hidden; the mark and the project crumb stay.

## Tests

Unit:
- `workspace`: `emptyWorkspace()` has no projects and a null active id; deleting the last project yields the empty workspace; `activeProject` returns null on it.
- `storage`: a workspace with a null active id and empty list round-trips and validates; a null id with a non-empty list is rejected.
- `WorkspaceContext`: deleting the last project leaves `activeProject` null; `updateActiveProject` with no active project does nothing.
- `useImportFlow`: opening the picker, selecting a preview, confirming in each mode.
- `AppStateContext`: the two `deleteProject` tests are removed.

E2E, `e2e/projects.spec.ts`:
1. First load shows the welcome screen; no section tabs, no Export, no switcher.
2. "Create your first project" lands on `/project`; naming it updates the header and tab title.
3. Deleting the last project from `/projects` shows the "No projects yet" card and does not recreate anything.
4. "Create project" from that card lands on `/project`.
5. From the overview, the project card's trash deletes the project and shows the welcome screen.

`createFromOverview` in `e2e/fixtures/app.ts` becomes: if the welcome screen is showing, create the first project, then go to `/overview` and click the requested "Create …" card. The four specs with their own copy of that flow (`cf-standard-name`, `conditional-fields`, `variable-roundtrip`, `dosing-location`) call the helper instead. `dataset-conditional-restore` imports a fixture from the header menu, which still works from the welcome screen.

## Docs

`docs/multi-project.md`: add the empty state, the welcome screen, and the single delete semantics. The multi-project spec's "Overview: unchanged" and "deleteProject creates a fresh Unnamed Project" lines are superseded by this document.

## Out of scope

Naming a project before it is created, a guided tour, per-project settings, cloud sync.
