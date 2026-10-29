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
- Changed projects save after a two-second debounce; existing merge rules
  reconcile disjoint edits and retain conflicting drafts in memory.
- The client checks the owner before obtaining an access token for each request.
  Never configure a browser with a service-role key.
- Local migration sources are inspected without rewriting guest storage.
  Cleanup removes only an acknowledged, unchanged source.
- Stop removes listeners/timers and ignores late responses after account changes.

The login-only cloud icon beside Import shows pending, saved, or failed state.
Hover for details and click for a notification with retry. Notifications appear
bottom-right and dismiss automatically.

After login, a prompt offers to import local projects or explicitly clear their
copies. Imports remove only acknowledged, unchanged sources. Errors retain the
sources and allow retry or continuing without deleting local copies. Regular
file import remains available.

Authenticated drafts stay in memory, not localStorage. Project transitions and
sign-out await saves. Interrupted account-specific drafts can be recovered or
exported after signing back in; recovery moves snapshots into Jotai once, so a
failed save retries the live draft rather than importing it again.

Run the workspace, project page, import, and auth lifecycle tests plus
`npm run build`. The opt-in local Supabase integration test uses disposable users.
Cross-window refresh and explicit conflict discard are the next layer.
