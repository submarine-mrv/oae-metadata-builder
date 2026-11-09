# Private project cloud sync

Signed-in Supabase users now edit private cloud projects directly from Jotai.
Guests and the memory auth provider retain browser persistence. Enable with
`VITE_AUTH_ENABLED=true` and a Supabase URL/publishable key.

- One owner-isolated `metadata_builder_sessions` row stores each project.
- Conditional saves/deletes use the acknowledged hash to reject stale writes.
- Drafts carry `schemaVersion` (missing means 1). Bump `PROJECT_SCHEMA_VERSION`
  with state migrations. Newer drafts are never parsed, merged or saved by an
  older build; reload is required for those projects while others can still save.
  The server also rejects version downgrades even with a matching hash.
- Changed projects save after a two-second debounce. A stale save merges with
  the cloud copy field by field, for project fields and each experiment and
  dataset's top-level fields; edits to the same field conflict and stay in memory.
  Changing an experiment's or dataset's type conflicts with any other edit to it.
  Experiments (or datasets) added on both sides conflict, because the counter
  IDs collide; UUIDs remove that with collaboration. Remote additions keep their IDs.
- Deletes win: something deleted elsewhere is removed here even over unsaved
  edits. A yellow "Deleted elsewhere" notice names it and says when edits were
  lost; if its experiment or dataset page was open, the app goes to Overview.
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
with two choices, keep mine or use the other version, and a link to export first. Other errors show the message, with Retry save unless the project has a
newer format.

Tabs pick up changes made elsewhere by comparing hashes, loading projects only
when one differs. Checks run on project switch, opening All projects, page
changes within a project (at most every 10 s), returning to the tab, coming back
online, and every 60 s while visible; never while a save runs. A project with
unsaved edits keeps them and merges the newer copy on its next save. Projects
added or deleted elsewhere appear or disappear, with the usual notice.

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

Run the workspace, project page, import, and auth lifecycle tests plus
`npm run build`. The opt-in local Supabase integration test uses disposable users.
