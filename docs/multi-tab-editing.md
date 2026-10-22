# Editing in more than one tab

The builder does not coordinate open tabs. This page describes what happens when someone uses more than one, and the alternatives if that needs to change.

## Behaviour

Each tab keeps its own copy of the workspace and saves the whole of it to localStorage. This holds whether or not the user is signed in.

**Without signing in**, the last tab to save wins. Changes made in another tab are overwritten, including changes to other projects, because every project is saved in the same entry.

**Signed in**, each tab also syncs its copy with the cloud workspace, and tabs and devices reconcile through that sync rather than with each other. Edits from another tab or device reach a tab when it next syncs, not as they happen, and the cloud merge rules decide what happens when two copies changed the same thing. Those rules are described with the cloud sync code. There is no real-time co-editing.

## Alternatives

| Option | What the user sees | What it takes |
|---|---|---|
| **Leave as is** (current choice) | As described above | Nothing |
| **One editor per project** | A project open in another tab is read-only, with "Edit here" to take over. Different projects can be edited in different tabs | A per-project lock (Web Locks API); saving each project under its own localStorage key; a revision check before each local save |
| **One tab for the whole app** | A second tab shows "The builder is open in another tab. Use here" | One app-wide lock; storage unchanged |
| **Real-time co-editing** | Simultaneous editing, as in Google Docs | Operation-level merging on a server; a large project |

A lock only coordinates tabs in one browser. Edits made on another device still meet through the cloud merge.

## Decisions to make if this is revisited

1. **Same project in two tabs:** editable in both, or read-only in the second?
2. **Different projects in two tabs:** must they stop overwriting each other? Per-project storage keys fix this on their own, without a lock.
3. **A conflict on a local save:** let the last save win, or stop and offer a reload?
4. **Deletions:** should a project deleted on one device stay deleted everywhere? That depends on the cloud merge recording deletions rather than only comparing which projects each copy has.
