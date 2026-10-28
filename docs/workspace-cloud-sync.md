# Project cloud sync and sharing

Signed-in Supabase users edit cloud projects directly from Jotai, and can share
them with other people.
Guests and the memory auth provider retain browser persistence. Enable with
`VITE_AUTH_ENABLED=true` and a Supabase URL/publishable key.

- One `metadata_builder_sessions` row stores each project. Whoever first saves it
  owns it for good.
- The owner shares a project by email as **editor** (edits everything) or
  **viewer** (read only), from Share on its Overview. A grant applies to whoever
  signs in with that confirmed email, so people can be added before they have an
  account; there is no accept step. Only the owner deletes the project or manages
  people; members can leave.
- Projects load through one RPC that returns each project's role, owner email,
  last editor and member count (`projectAccessAtom`). Viewers get disabled forms
  and no add, delete, duplicate or merge-import actions; their copies never save,
  and refresh replaces anything they change locally, including after a downgrade, with a notice when that discards unsaved edits. A save refused because the role changed
  shows "You can no longer edit this project."
- Losing access to a shared project removes it like a delete, with a "No longer
  shared" notice.
- Conditional saves/deletes use the acknowledged hash to reject stale writes.
- Experiment and dataset IDs are UUIDs. Older drafts, such as guest projects in
  browser storage, numbered them; parsing turns those into `experiment-N` / `dataset-N`, the same in every
  tab, so two people loading one old draft agree on its IDs.
- Drafts carry `schemaVersion` (missing means 1). Bump `PROJECT_SCHEMA_VERSION`
  with state migrations. Newer drafts are never parsed, merged or saved by an
  older build; reload is required for those projects while others can still save.
  The server also rejects version downgrades even with a matching hash.
- Changed projects save after a two-second debounce. A stale save merges with
  the cloud copy field by field, for project fields and each experiment and
  dataset's top-level fields; edits to the same field conflict and stay in memory.
  Changing an experiment's or dataset's type conflicts with any other edit to it.
  Lists such as a dataset's variables count as one field. Experiments and datasets
  added on both sides are all kept.
- Deletes win: something deleted elsewhere is removed here even over unsaved
  edits. A yellow "Deleted" notice names it and says when edits were
  lost. If it was open, the app goes to All projects for a project, or Overview for an experiment or dataset.
- While saves fail, retries back off from 5 s to 60 s and new edits wait for the
  next retry. Offline shows as pending until failures last 30 s.
- The client checks the owner before obtaining an access token for each request.
  Never configure a browser with a service-role key.
- Local migration sources are inspected without rewriting guest storage.
  Each imports as a new cloud project and never merges into an existing one.
  Cleanup removes only an acknowledged, unchanged source.
- Stop removes listeners/timers and ignores late responses after account changes.

The login-only cloud icon beside Import shows pending, saved, or failed state.
Hover for details. Only the failed state is clickable. A conflict opens a dialog
with two choices, keep my changes or use newer changes. The choice applies only
where both sides edited the same thing; every other edit from either side is
kept. On a shared project,
Overview shows who last edited it ("you" for your own edits). Other errors show the message, with Retry save unless the project has a
newer format.

Tabs pick up changes made elsewhere by comparing hashes, loading projects only
when one differs. Checks run on project switch, opening All projects, page
changes within a project (at most every 10 s), returning to the tab, coming back
online, and while visible every 10 s when the open project is shared, otherwise
every 60 s; never while a save runs. A project with
unsaved edits keeps them and merges the newer copy on its next save. Projects
added or deleted elsewhere appear or disappear, with the usual notice. While a variable editor
is open, background saves and checks wait, because Save writes the draft back by
list position; they run as soon as it closes.

After login, a prompt offers to import local projects or explicitly clear their
copies. Imports remove only acknowledged, unchanged sources. Errors retain the
sources and allow retry or continuing without deleting local copies. Regular
file import remains available.

Authenticated drafts stay in memory, not localStorage. Switching projects saves
in the background without waiting; sign-out and deleting a project await saves. Interrupted account-specific drafts can be recovered or
exported after signing back in. Recovery adds projects the account doesn't have
and brings back any that differ from the cloud as a "(recovered)" copy, since
without the saved baseline it can't merge them safely. Snapshots move into Jotai
once, so a failed save retries the live draft rather than importing it again.

## Verification

Run the workspace, project page, import, and auth lifecycle tests plus
`npm run build`. The opt-in local Supabase integration tests (sync, sharing, and
publication) use disposable users.

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

Discovery does not rewrite guest storage. Cleanup compares the original source,
not its migrated form. After an error, the prompt reloads current sources and
also allows continuing without deleting local copies.

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
Supabase catalog reader. Publish a sample complete project from MB, refresh
Web search and its detail/download, edit and update, unpublish and check a fresh
anonymous read, then republish. Verify conflicts and failures leave the previous
public tree intact. Do not use real private metadata for these checks.
