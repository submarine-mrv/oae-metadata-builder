# Private project cloud sync

Signed-in Supabase users edit private cloud projects directly from Jotai.
Guests and the memory auth provider retain local persistence. Enable with
`VITE_AUTH_ENABLED=true` and a Supabase URL/publishable key; never use a
service-role key in the browser.

## Saving

- Drafts carry `schemaVersion` (missing means 1). Bump `PROJECT_SCHEMA_VERSION`
  with state migrations. Newer drafts are never parsed, merged or saved by an
  older build; reload is required for those projects while others can still save.
  The server also rejects version downgrades even with a matching hash.

- Each project has one owner-isolated `metadata_builder_sessions` row.
- Only changed projects are saved, after a two-second debounce. Conditional
  saves/deletes protect against stale writes; existing merge rules are unchanged.
- Visible windows refresh every 15 seconds and on focus, visibility return, or
  reconnect. Reads and writes are serialized; clean snapshots update directly,
  while unsaved edits use the existing conflict rules. Remote deletions never
  silently discard unsaved drafts or recreate deleted projects.
- The cloud beside Import is neutral while waiting/saving, green when saved,
  and red on failure. Hover for details; click for a notification and retry.
  Conflicts offer an export and an explicit, confirmed discard of that project's
  local changes in favor of the latest cloud state, including remote deletions.
- Authenticated drafts stay in memory until acknowledged, not localStorage.
  Keep the tab open when offline or saving fails; export before leaving.
- Project transitions and sign-out await saves. Page-hide/exit attempts a flush,
  but browser termination cannot guarantee a final save.
- Account-change recovery imports each retained snapshot into Jotai only once.
  If saving fails, retry sync on the live draft rather than importing it again.
- All projects clears the active selection without deleting project content.

## Importing local projects

After login and cloud loading, a prompt offers to import local projects or clear
them without importing. **Declining permanently removes the local project
copies**, as the prompt explains. Cloud projects are not deleted.

Imports require consent. Each local source is removed only after cloud
acknowledgement; failures retain remaining sources and allow retry. Concurrent
local edits are checked before cleanup. Completion uses an auto-dismissing
bottom-right notification. The regular Import button remains available for
metadata files.

Discovery does not rewrite guest storage. Cleanup compares the original source,
not its migrated form. After an error, the prompt reloads current sources and
also allows continuing without deleting local copies.

## Verification

```sh
NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/workspace/__tests__ \
  src/auth/providers/supabase/__tests__/projectClient.test.ts \
  src/hooks/__tests__/useImportFlow.test.tsx src/pages/projects/__tests__
npm run build
```

Verify login, migration/decline, indicators, account isolation, and transitions
against local Supabase. In two isolated windows, check polling/focus updates,
disjoint edits, conflicts, and clean/dirty remote deletions without reloading.
Use disposable test data; do not reset useful data. Publishing is outside this PR.
