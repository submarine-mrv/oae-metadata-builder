# Workspace cloud sync

## Activation and local behavior

Cloud workspace sync runs only when `VITE_AUTH_ENABLED=true` and there is a
valid authenticated session. Every authenticated user syncs automatically.
With auth disabled or no session, MB continues to use the existing local-only
workflow and makes no workspace cloud requests.

LocalStorage remains the working copy. Local edits are persisted first using
the existing autosave behavior; Supabase failures do not block editing or
replace local data. The navigation header shows `Syncing`, `Synced`, `Pending`,
or `Sync error`; errors can be retried from the header.

Guest and account workspaces are stored separately when a user signs in,
switches accounts, or signs out. Signing out saves the signed-in workspace in
its local account backup and restores the guest workspace. The account's cloud
workspace remains private to that authenticated user.

## Merge behavior

Cloud reconciliation reuses `applyImport` semantics for a matching
`project_id`:

- Project fields from the incoming snapshot merge over the current project.
- Experiments with a matching `experiment_id` are replaced; new experiments
  are added.
- Datasets are added, except datasets with identical form data are skipped so
  retries of the same snapshot are idempotent.
- Projects that exist on only one side are retained. The current active project
  remains active when it still exists.
- A valid legacy single-project cloud snapshot is migrated to the versioned
  workspace envelope on its next successful sync.

If a compare-and-save detects a newer cloud revision, MB merges that snapshot
into the current local workspace using these same rules, then retries against
the new revision. This does not implement real-time collaborative editing.

## Offline and cloud contract

While offline, changes remain in localStorage and the latest full workspace is
queued; intermediate edits are not replayed. On reconnect, MB uploads the
current snapshot. The header does not report `Synced` until Supabase confirms
the save.

IAC stores private snapshots in `public.metadata_builder_sessions`, protected
by authenticated owner RLS. MB reads the user's own row and writes through
`public.save_metadata_builder_session`. The RPC compares the expected
`state_hash` atomically and returns the latest snapshot on a stale revision.
Authenticated clients cannot write the table directly, preventing a client
from bypassing the compare-and-save check. See the IAC migration
`202609180001_create_metadata_builder_sessions.sql` and
`supabase/sql-tests/metadata_builder_sessions.sql`.

## Project publishing

Publishing is a separate, explicit operation and does not change draft sync.
On the project form, authenticated users can review and publish the complete
project, experiment, and dataset tree, update an existing publication, or
unpublish it. Publication is blocked unless all form records pass the OAE
protocol validation and every dataset references an experiment in the project.

MB maps normalized searchable fields into `oae_projects`,
`oae_experiments`, and `oae_datasets`. Each row also stores its complete
protocol form data under `extras._source`, which the Web catalog reader uses
to reconstruct fields not normalized in the database. Publishing and
unpublishing use owner-scoped atomic RPCs; direct authenticated table writes
are revoked so clients cannot bypass whole-tree validation or visibility
changes. Unpublishing preserves the private workspace draft and hides the full
tree from anonymous reads.

## Controlled release

Release readiness does not authorize a deployment. Record the release owner,
approved target, Supabase project reference, MB/Web commit SHAs, IAC migration
revision, and deployment IDs before enabling the feature. Do not use a preview
build with production credentials for testing.

### Configuration and ordering

| Application | Setting | Release behavior |
| --- | --- | --- |
| MB | `VITE_AUTH_ENABLED=true` | Enables auth and automatic sync for every signed-in user; also enables publication controls. |
| MB | `VITE_AUTH_ENABLED=false` | Keeps editing local-only and hides publication controls, even if a stored session exists. |
| MB | `VITE_AUTH_PROVIDER=supabase` | Uses the Supabase auth provider. |
| MB and Web | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Must identify the same approved Supabase project; never use a service-role or secret key in a browser build. |
| Web | `VITE_USE_SUPABASE=true` | Reads the public Supabase catalog rather than bundled JSON. |

These are Vite **build-time** variables. Changing a hosting environment variable
does not change an existing bundle: rebuild, deploy, and reload the application.
Neither repository's Netlify configuration declares the release flags; verify
the effective build-context variables in the hosting provider. There is no
per-user opt-in or cohort allowlist. A pilot requires an isolated deployment and
test database; an enabled build syncs for all of its signed-in users.

1. Obtain approval for the exact environment. Commit and review coordinated
   changes in IAC, Web, and MB; do not release an unrecorded dirty working tree.
2. Verify IAC migrations, grants, RLS, and all three RPCs in that environment:
   `save_metadata_builder_session`, `publish_oae_project`, and
   `unpublish_oae_project`. Run the SQL tests against a disposable local stack.
3. Existing migrations were edited during development. If any edited migration
   version is already recorded in the target database, a normal migration push
   will **not** reapply it. Stop and prepare a reviewed forward migration for
   the missing definitions/grants. Do not reset a populated remote database or
   mark migrations unapplied to force replay. An empty migration dry-run alone
   is not proof that the target schema matches.
4. Verify the Supabase Auth site URL, allowed callback/recovery URLs, email
   confirmation delivery, and public-key configuration for the approved origin.
5. Deploy the compatible Web reader before enabling publication in MB. Existing
   cached catalog results can remain until a refetch: queries have a five-minute
   stale time, but there is no polling or window-focus refetch. Reload Web to
   verify unpublish visibility; do not promise a five-minute maximum delay.
6. Deploy MB with auth disabled first. Verify guest editing, import/export, and
   reload persistence with no workspace or publication requests.
7. After pilot approval, rebuild MB with auth enabled in the isolated test
   context. Verify login merge, offline/reconnect, two-client conflicts, and
   logout/account isolation. Publish, update, unpublish, and republish a valid
   project with experiments/datasets; inspect Web anonymously after each action.
8. Obtain separate production approval before promoting the tested release.
   Record smoke-test results and monitoring ownership.

### Local verification

From MB:

```bash
npm run check:fix
npx vitest run src/workspace/__tests__/cloudSync.test.ts \
  src/workspace/__tests__/merge.test.ts \
  src/workspace/__tests__/storage.test.ts \
  src/workspace/__tests__/WorkspaceSyncController.test.tsx \
  src/workspace/__tests__/publicationPayload.test.ts \
  src/workspace/__tests__/ProjectPublicationControl.test.tsx
npm run build
```

From IAC, with local Supabase already running:

```bash
supabase/sql-tests/run.sh
supabase db lint --local
```

From Web:

```bash
npx vitest run src/api/__tests__/supabase-projects.test.ts \
  src/pages/search-data/__tests__/SearchResults.test.tsx
npm run build
```

Do not reset a database used by other developers just to run these checks.
Passing tests/builds does not replace the environment-specific browser pilot.

## Monitoring and support

The initial release has local UI status and Supabase API/Postgres/Auth logs,
not a centralized workspace/publication metrics dashboard or automatic alerts.
Assign an operator to review these during the pilot and after each rollout.
Do not interpret GA page views as sync success or conflict measurements.

| Signal | Interpretation and action |
| --- | --- |
| `Synced` | The current reconciliation/save completed; not a promise that other devices have refetched. |
| `Pending` | Offline work is queued locally. Restore connectivity and check for `Synced`. |
| `Sync error` | A load/save failed or exceeded the conflict retry limit. Preserve local work, inspect the error, then retry. |
| Repeated stale-revision conflicts | Up to three immediate conflict retries are allowed per save attempt. After that, stop competing edits and use Retry. |
| Publication/status error | Check auth, RPC availability, validation, and ID ownership. Do not bypass the RPC with direct writes. |
| Repeated HTTP 401/403, 429, or 5xx | Check session validity, policies/grants, rate limits, and service health in Supabase logs; pause rollout if persistent. |

A failed save remains queued without a tight automatic retry loop. The next
local edit, an online event, or the header Retry action can trigger another
attempt; initialization failures can also be retried. If auth has expired,
preserve/export the draft before signing in again.

For an incident, record the deployment ID, UTC time, operation (`load`, `save`,
`publish`, or `unpublish`), HTTP status/error code, and whether connectivity
was available. Do not send workspace JSON, project metadata, user emails,
tokens, callback URLs, or raw error payloads to analytics or public issue
trackers. Collect reproduction details privately with the user's consent.
Use Supabase logs to investigate server failures; never expose privileged
credentials to the browser for diagnosis.

Stop rollout immediately for cross-account visibility, lost local drafts,
partial publication, unpublished data visible on a fresh anonymous fetch, or
unbounded requests. Persistent sync/publication failures are also a no-go:
keep the pilot isolated until resolved.

### Recovering local work

1. Keep the affected browser profile and origin intact. Do not clear site data,
   localStorage, or run a database reset. Local work may be newer than cloud.
2. Export each important project through MB's normal Export action before
   logout, account switching, rollback, or attempts to reconcile other devices.
   Store exports privately; they contain project metadata.
3. For offline status, reconnect. For a transient save error, use Retry and
   verify `Synced`. For competing edits, stop other clients before retrying.
4. If login merge or storage access fails, preserve the local workspace and
   account backups before reloading. Ask support for a private recovery rather
   than overwriting cloud state. Storage keys are
   `oae-metadata-builder-workspace`, its `-guest` snapshot, and
   `-account-<encoded-user-id>` snapshots. Existing unreadable-data backups use
   the `-backup-` prefix. Do not share these values publicly.
5. Publication validation errors require fixing the draft, not deleting it.
   Unpublishing does not delete the draft or owner rows.

### Rollback

1. Ask active pilot users to export their latest projects before replacing the
   build where feasible. Pause publication activity and record the incident.
2. Rebuild/redeploy MB with `VITE_AUTH_ENABLED=false` in the affected context.
   Verify the deployed bundle after reload: no auth/publication controls and no
   workspace/publication network requests; local edits and exports still work.
   Open tabs running the old bundle must reload before the switch takes effect.
3. Keep the same origin. Do not delete account backups, guest snapshots,
   workspace session rows, or published metadata as a rollback action. Disabling
   auth does not merge account backups into the guest workspace or remove data
   already published. Use saved exports/private recovery if a draft is not in
   the active local copy.
4. Do not reverse the IAC schema or revoke read access as routine rollback.
   Keep the compatible Web reader. Switching Web to bundled JSON is a separate
   approved rollback and may show an older catalog; it is not unpublishing.
5. To withdraw a publication, use the owner's Unpublish action in an approved
   authenticated build. A deployment rollback alone does not withdraw it.
6. Before re-enabling auth, resolve the incident, rerun the local checks and
   isolated pilot, and obtain fresh release approval.
