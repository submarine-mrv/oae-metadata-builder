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

Run the workspace, project page, import, and auth lifecycle tests plus
`npm run build`. The opt-in local Supabase integration tests (sync and sharing) use disposable users.
