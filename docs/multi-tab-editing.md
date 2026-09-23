# Editing in more than one tab: options

For review with Json before cloud sync. This records a decision still to be made; it will be replaced by a short description of whatever we choose.

## Where we are

Each open tab keeps its own copy of the workspace and saves the whole thing to one localStorage entry. Two open tabs therefore overwrite each other's changes. That is true even when they edit different projects, because every project lives in the same entry.

PR #82 first added automatic merging between tabs and then removed it. Making the merge safe took deletion records with an expiry, per-tab tracking of unsaved edits, a read-merge-write on every save, object-identity preservation so open editors weren't reset, and form resets when another tab deleted the open record. Each fix surfaced a new edge case. The merge is the wrong layer to solve this in for a metadata builder, where one person usually edits their own project.

## How other apps do it

Google Docs, Figma, Notion and Linear never have tabs talk to each other. Every tab is a client of a server, and the server orders every change. They merge small units (a character, a property, a block), so conflicts are rare and cheap to resolve. Real-time co-editing is their core product and took years to build.

## Will cloud storage fix it?

It makes the mechanism simpler: the server numbers every save, so a save can say "only if nobody saved since version N" and a stale write becomes an explicit conflict instead of a guess. It does not remove the policy question. Two tabs, two devices or two people editing one project still need a rule. And the builder works without login, so the local-only case stays.

## Options

| | What the user sees | Code | Fits cloud |
|---|---|---|---|
| **A. Do nothing** (today) | Two tabs silently overwrite each other | None | No |
| **B. One editor per project** (recommended) | A project open in another tab is read-only here, with "Edit here" to take over. Different projects can be edited in different tabs | Per-project storage keys plus an index; a per-project lock (Web Locks API); a revision check on save | Yes: same rule, server-enforced |
| **C. One tab for the whole app** | A second tab shows "The builder is open in another tab. Use here" | One app-wide lock; storage unchanged | Partly: still need a rule across devices |
| **D. Automatic merge** (what #82 removed) | Tabs merge silently; concurrent edits to one project keep the later one | Merge rules, deletion records, dirty tracking, read-merge-write | Would be rebuilt against a server |
| **E. Real-time co-editing** | Google Docs-style simultaneous editing | Operation-level merging on a server | Yes, but a large project |

Option B in more detail:

1. **Per-project storage.** Each project is saved under its own key, with a small index of project ids. A tab only ever writes the project it is editing, so tabs on different projects cannot clobber each other. This matches the cloud model of one row per project.
2. **Per-project lock.** The Web Locks API (current Chrome, Firefox and Safari) lets a tab claim a named lock. The tab that holds a project's lock edits it; others show it read-only and reload it when it changes. "Edit here" takes the lock over.
3. **Revision-checked saves.** Each project carries a revision number. A save goes through only if the stored revision still matches what the tab loaded. Otherwise the tab stops and offers to reload. This covers the rare cases the lock misses, and it is the same answer a cloud save would give for a conflict.

What B costs: you cannot edit one project in two tabs side by side. You can view it in a second tab, and you can edit two different projects in two tabs.

## Decisions to make

1. **Same project in two tabs:** editable in both, or read-only in the second with "Edit here"? Recommendation: read-only.
2. **Different projects in two tabs:** supported? Recommendation: yes; per-project storage makes it nearly free.
3. **When a conflict happens anyway:** block the save and offer a reload, or let the last save win silently? Recommendation: block and reload.
4. **Cloud scope:** is real-time co-editing a goal, or does "one editor per project, with a clear conflict message" hold in the cloud too? Recommendation: the latter. Revisit if collaboration becomes a real requirement; that is also when entity-level merging and UUID entity ids would come in.
5. **Offline for logged-in users:** local-first with background sync, or online-only editing? This decides whether the cloud path needs a queue of pending saves.

## If we choose B

One follow-up PR: per-project storage with a migration from the single entry, the lock with a read-only banner and "Edit here", and revision-checked saves. Expected to be much smaller than the merge that was removed, and the same rules carry over to a cloud store.
