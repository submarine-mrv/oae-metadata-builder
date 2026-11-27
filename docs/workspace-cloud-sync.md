# Project cloud sync and sharing

Signed-in Supabase users edit cloud projects directly from Jotai, and can share
them with other people.
Guests and the memory auth provider retain browser persistence. Enable with
`VITE_AUTH_ENABLED=true` and a Supabase URL/publishable key.

- Drafts are stored one row per entity: `draft_projects`, `draft_experiments`
  and `draft_datasets`, each with its protocol `form_data` and a `content_hash`.
  `draft_projects.project_hash` changes when any row of the project changes.
  A dataset's `experiment_uuid` is a foreign key; deleting the experiment
  unlinks the dataset. Whoever first saves a project owns it for good.
  Internal identities are UUIDs (`project_uuid`, `experiment_uuid`,
  `dataset_uuid`); older non-UUID IDs map to stable UUIDs (`stableUuid`).
- The owner shares a project by email as **editor** (edits everything) or
  **viewer** (read only), from Share on its Overview. Grants belong to the
  person's account, not the address, so they follow email changes. Someone with
  a confirmed account gets access at once and no email. Anyone else is created
  as a pending account and emailed an invitation (the `project-members` Edge
  Function in oae-iac); they get access once they accept it. Only the owner sees
  pending people, marked Pending, with Resend. If the invitation email can't be
  sent, the person isn't added and the owner sees an error. Only the owner
  deletes the project or manages people; members can leave.
  Grants live in `mb_members`; `mb_invites` records invitation-send attempts.
- An invited account has no password of its own until it sets one, flagged by
  `invited_at` without `user_metadata.password_set` (`AuthUser.needsPassword`).
  The root route sends it to `/auth/set-password` and cloud sync waits until
  then. An expired or superseded invitation link lands on sign-up, which works
  for the invited address and shows the shared projects once confirmed.
- Projects load through one RPC that returns each project's role, owner email,
  last editor and member count (`projectAccessAtom`). Viewers get disabled forms
  and no add, delete, duplicate or merge-import actions; their copies never save,
  and refresh replaces anything they change locally, including after a downgrade, with a notice when that discards unsaved edits. A save refused because the role changed
  shows "You can no longer edit this project."
- Losing access to a shared project removes it like a delete, with a "No longer
  shared" notice.
- Signed-in users can copy links to saved cloud project pages from the menu or
  Share dialog; the controls are hidden for guests and until a new project is
  saved. Project members, including viewers, can open those links. Copy link is
  also hidden on not-found pages, where no specific entity
  is selected. A link resolves only among projects the recipient can access, and
  a missing match reads as "can't be found", just like a deleted project. All
  links use stable internal IDs, including after publication. Human metadata IDs
  never enter URLs. See `docs/multi-project.md`.
- A save sends only rows that differ from the acknowledged copy, each with the
  hash it was based on (`projectCloudSync/rows.ts`). If other rows changed
  elsewhere, the save still applies and returns `merged` with the current
  project; only a row changed on both sides returns `conflict`. Deletes use the
  acknowledged project hash.
- Draft saves accept duplicate project and experiment metadata IDs unchanged.
  `check_metadata_builder_id_availability` checks catalog availability when an
  ID field loads or loses focus, not on every keystroke. A field advisory explains
  conflicts or check failures without blocking edits or sync, and offers Recheck ID.
  At publication, the database enforces one case-insensitive namespace for project and experiment IDs.
  Drafts do not reserve names, so an available ID may be claimed before publication.
  The advisory also flags a published ID that was changed (`renamed`), since
  republishing refuses it. Unpublishing releases the project's IDs.
- Experiment and dataset IDs are UUIDs. Older drafts, such as guest projects in
  browser storage, numbered them; parsing turns those into `experiment-N` / `dataset-N`,
  and the cloud maps those to the same stable UUID in every tab. A local project
  whose UUIDs are already used by another cloud project imports under fresh ones.
- Each variable carries a `_uuid` so merges match variables by identity. It is
  stripped from exports and published documents.
- Local drafts carry `schemaVersion` (missing means 1). Bump `PROJECT_SCHEMA_VERSION`
  with state migrations. Cloud projects carry the protocol release
  (`PROTOCOL_SCHEMA_VERSION`) in `draft_projects.schema_version`. A project saved
  at an older release is rewritten whole, which upgrades it in one transaction.
  A newer one is never parsed, merged or saved by an older build; reload is
  required for those projects while others can still save. The server enforces
  both directions.
- Changed projects save after a two-second debounce. A stale save merges with
  the cloud copy field by field, for project fields and each experiment and
  dataset's top-level fields; edits to the same field conflict and stay in memory.
  Changing an experiment's or dataset's type conflicts with any other edit to it.
  A dataset's variables merge one by one by `_uuid`; other lists count as one
  field. Experiments, datasets and variables added on both sides are all kept.
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
that loads the latest cloud copy. The widened modal uses a field navigator on
desktop when several clashes need review, grouped under each project,
experiment or dataset; with one clash, the navigator is hidden. Local for all /
Cloud for all sit beside the Text / JSON diff toggle under the description.
Below the comparison, choose Keep Local version or Use Cloud version; on
desktop, Next field moves to the following clash. On mobile, the modal fills
the screen and shows one field at a time with previous/next navigation. Apply
stays disabled until
every clash has a choice. A global Text / JSON diff toggle switches the
comparison: Text shows strings, numbers and booleans in full, while objects
and arrays always use the generic JSON diff, which lists only the changed JSON
Pointer paths (object key order is ignored). The diff uses `jsondiffpatch`:
array items are matched by content, so an inserted or deleted entry is one
whole-item Added/Removed row instead of shifting every later index, and a
reorder is a Moved row. An object removed and another added at the same index
are shown as one edited item, so a single changed property stays one row.
There are no field-specific differs. A choice covers that whole top-level
field; a type change, a clashing addition, or a project with no shared baseline
is one whole-item choice. Every other edit from either side is kept. If the
clashes change before Apply (an edit elsewhere or here), nothing is saved: the
dialog refreshes, keeps choices whose values are unchanged, and asks for
another look. On a shared project, Overview shows who last edited it ("you"
for your own edits). Other errors show the message, with Retry save unless the
project has a newer format.

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

## Project publication

With Supabase authentication enabled, the project owner can select **Publish**
below the project title on Overview to review and publish its complete metadata
tree. Published projects show **Publish Updates** and a separate **Unpublish**
action, which opens the unpublish confirmation directly. **Publish Updates** is
disabled when the current metadata matches the published snapshot, including
after a reload or reverting an edit. Internal workspace timestamps and selection
changes do not count as updates. The Projects list shows
a **Published** badge only for projects confirmed as public; private projects
have no publication badge. All project,
experiment and dataset metadata must pass validation. The confirmation explains
that names, emails, identifiers and access links become publicly downloadable.
Publishing first saves the private draft, then asks the server to publish the
saved rows at the acknowledged project hash. The server builds the document
from the draft rows, so it refuses if the draft changed since.

- **Publish project / Update publication** adds an immutable snapshot
  (`published_snapshots`, next `version_no`) and makes it the live one. Removed
  experiments and datasets disappear from the publication.
- **Unpublish** followed by **Confirm unpublish** marks the live snapshot as
  not live and releases its IDs, without deleting the private draft or earlier
  snapshots. Existing downloads and
  already-open browser pages cannot be recalled. Unpublishing does not depend
  on private draft saves, so a draft conflict cannot prevent hiding public data.
- **Republish** uses the same reviewed publication action.
- Publication is bound to the internal entity UUIDs (`published_entities`).
  A published project or experiment ID can't change on republish; the one
  exception is a legacy ID that fails the 0.8.0 pattern. IDs held by another
  project are rejected.
- Draft edits remain private until the next explicit publication. Unpublish
  before deleting a published draft; deletion is blocked while it is public.
  The delete buttons on Overview and Projects are disabled for published
  projects, with a tooltip explaining that the project must be unpublished first.

The client uses owner-bound tokens and the `publish_oae_project` and
`unpublish_oae_project` RPCs. Direct authenticated catalog mutations are denied.
Readers use the `published_projects` view of live snapshots, which keeps the
complete exported metadata document for lossless Data Commons downloads; no private workspace
wrappers, internal counters or auth credentials are included in those documents.
Guests, auth-disabled builds and the memory auth provider have no publication
controls or requests.

Draft RPCs are `save_metadata_builder_project` and
`delete_metadata_builder_project`; internal-ID arguments are `p_project_uuid`,
and editable metadata IDs remain `project_id`/`experiment_id`. Rebuild a
development database from the rewritten IaC migrations before using this
client; this is not an additive upgrade for a previously applied migration
history.
