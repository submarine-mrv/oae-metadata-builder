# State management for the metadata builder: Jotai vs Zustand

> **Status:** Implemented in PR #82; see `docs/multi-project.md` for the current design. Two points differ from the plan below. The routed page still remounts on project switch, keyed on the project id, so page-local UI state starts fresh; the forms themselves read and write the store. Multi-tab sync is deferred; see `docs/multi-tab-editing.md`.

Written 2026-09-22 while auditing PR #81 (multiple projects), for review in PR #82. Recommendation: **Jotai**. This note compares the two and describes the pattern either would follow. It is a review aid and will be removed once the choice is made.

## The problem

After #81, the builder keeps one project's data in two places:

- `WorkspaceProvider` (`src/workspace/WorkspaceContext.tsx`, ~170 lines) holds every project as a saved `ProjectRecord`.
- `AppStateProvider` (`src/contexts/AppStateContext.tsx`, ~700 lines, 26 actions) holds a working copy of the open project and reports every change back through `onChange`. It is remounted with a React `key` whenever the active project changes.

Several of the bugs found in the #81 audit came from that mirror: an edit written to the wrong project after a switch, edits silently dropped for a stale active id, UI state resetting on switch, and the "revision key" multi-tab sync would have needed. Every keystroke also re-renders all ~80 `useAppState()` call sites, because the context value changes on every edit.

A store library fixes this by holding the project data once. Edits update the saved record directly, and components subscribe only to the slice they read.

## The builder's state shape

One nested document per project: project metadata, arrays of experiment and dataset records, and id counters. Most actions touch several parts at once. Changing an experiment's `experiment_id` rewrites the linked datasets; changing `project_id` rewrites every experiment and dataset. The actions are already written as pure `setState(prev => next)` reducers.

That shape matters more than either library's headline features.

## Comparison

| | Jotai | Zustand |
|---|---|---|
| Model | Atoms: small units of state, composed by derived atoms | One store object with actions, read through selectors |
| Fit for a nested document with multi-part updates | Good, if the whole workspace is **one atom** and actions are write-only atoms. Poor if split into many atoms, because cross-cutting updates then span atoms | Natural. The current reducers become `set(prev => …)` almost verbatim |
| Re-render control | Derived atoms (`atom(get => get(workspaceAtom).…)`), `selectAtom`, or `jotai-optics` `focusAtom` | Selectors with `useShallow` or equality functions |
| Persistence | `atomWithStorage` in `jotai/utils`. It syncs across tabs by default but replaces the whole value (last writer wins) and writes on every set. We would pass our own storage adapter with debounce and merge | `persist` middleware with `version`, `migrate` and `partialize`. Our `storage.ts` already does validation, migration and backups, so this adds little |
| Use outside React (route guards, analytics, tests) | `createStore()` / `getDefaultStore()` with `store.get` and `store.set` | `useStore.getState()` / `setState()` |
| Tests | Wrap in a `Provider` with a fresh `createStore()`, or `store.set` directly | Reset the module store between tests, or create a store per test |
| Devtools | `jotai-devtools` | Redux DevTools via middleware |
| Already used in the org | **Yes: `oae-data-web`** (4 primitive atoms for UI flags; server data goes through React Query) | No |
| Size | Small (a few kB); both are negligible next to RJSF and Mantine | Small (a few kB) |

## Recommendation: Jotai

On technical fit alone, Zustand is slightly ahead: the reducers port one-to-one and the store is one object, like our data. The gap is small, though. With one workspace atom and action atoms, Jotai ports the same reducers almost as directly, and derived atoms give the same re-render savings as selectors.

The deciding factor is the team. `oae-data-web` already uses Jotai, and Json, who will build cloud sync into the builder, knows it. One state library across both apps is worth more than Zustand's small edge.

## The pattern to use

- **One workspace atom**, holding the `Workspace` from `src/workspace/types.ts`. It is the single copy of project data.
- **A derived active-project atom** that reads the workspace. Pages read slices of it through further derived atoms (e.g. experiments list, one experiment by id) so a keystroke in one form doesn't re-render the others.
- **Write-only action atoms**, one per current `AppStateContext` action, carrying today's reducer bodies against the active project. Every write goes through them, so ID propagation and cleanup stay in one place.
- **UI state separate** (active experiment and dataset ids, JSON preview toggle) in small atoms, keyed by project id if it should survive a switch.
- **Do not** split project data into an atom per field or per entity. Cross-entity updates (ID propagation) would then span atoms and lose atomicity.
- **Persistence** as a custom storage adapter around the existing `storage.ts`: debounced write, immediate write on structural changes, flush on `pagehide` and when hidden, and a merge by `updatedAt` on the `storage` event for multi-tab sync.
- **Cloud sync stays local-first**: localStorage remains the instant copy, and the sync layer pulls, merges and pushes in the background through the same merge function. No async load or loading screen needed.

## What the migration deletes

- `AppStateProvider`'s mirroring: `initialState`, `onChange`, `persistedSubset`, `sameProjectState`, the `lastReported` ref.
- The keyed remount of the editor on project switch (and the one-frame old-route render it causes).
- `WorkspaceProvider`'s memoised context value and the `useAppState()` compatibility surface, once call sites read atoms directly.

## Open questions for the migration PR

- Whether entity display names stay stored or are derived from `formData.name`, as the project name already is.
- Whether entity ids become UUIDs, which only matters if cloud sync stores or merges below the project level.
- Whether to keep a thin `useAppState()` shim during the migration to keep the diff reviewable, then remove it.
