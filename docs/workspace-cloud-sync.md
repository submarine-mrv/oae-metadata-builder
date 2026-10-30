# Private project cloud sync

The project synchronization engine is available for integration; the app still
uses guest browser persistence at this stage.

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

Run the cloud engine, merge, storage, and Supabase client tests plus
`npm run build`. The opt-in local Supabase integration test uses disposable users.
Application activation, consent UI, and cross-window refresh are later layers.
