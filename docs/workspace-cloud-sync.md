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
Use disposable test data; do not reset useful data.

## Project publication

With Supabase authentication enabled, open **Publication** in the header to
review and publish the active project's complete metadata tree. All project,
experiment and dataset metadata must pass validation. The confirmation explains
that names, emails, identifiers and access links become publicly downloadable.
Publishing first saves the private draft and refuses to publish if that save
fails or the reviewed content changes.

- **Publish project / Update publication** atomically replaces the public tree.
  Removed experiments and datasets disappear from the publication.
- **Unpublish...** followed by **Confirm unpublish** hides the whole tree from fresh anonymous
  reads without deleting metadata or the private draft. Existing downloads and
  already-open browser pages cannot be recalled. Unpublishing does not depend
  on private draft saves, so a draft conflict cannot prevent hiding public data.
- **Republish** uses the same reviewed publication action.
- Publication is bound to the internal draft identity. Changing the editable
  metadata project ID and publishing again replaces the previous public ID;
  IDs belonging to another draft or owner are rejected.
- Draft edits remain private until the next explicit publication. Unpublish
  before deleting a published draft; deletion is blocked while it is public.

The client uses owner-bound tokens and the `publish_oae_project` and
`unpublish_oae_project` RPCs. Direct authenticated catalog mutations are denied.
The normalized public rows retain complete source objects and the exported
document envelope for lossless Data Commons downloads; no private workspace
wrappers, internal counters or auth credentials are included in those documents.
Guests, auth-disabled builds and the memory auth provider have no publication
controls or requests.

Local end-to-end verification requires the publication RPCs and Web's
Supabase catalog reader. Publish a synthetic complete project from MB, refresh
Web search and its detail/download, edit and update, unpublish and check a fresh
anonymous read, then republish. Verify conflicts and failures leave the previous
public tree intact. Do not use real private metadata for these checks.
