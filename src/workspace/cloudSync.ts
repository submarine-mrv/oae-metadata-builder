import type { WorkspaceSyncStatus } from "@/state/atoms";
import { workspaceAtom } from "@/state/atoms";
import type { AppStore } from "@/state/store";
import { parseProjectState } from "@/utils/parseProjectState";
import { mergeWorkspace } from "./merge";
import { isWorkspace, migrateLegacySession, WORKSPACE_KEY } from "./storage";
import type { Workspace } from "./types";
import { emptyWorkspace } from "./workspace";

const ACCOUNT_KEY = `${WORKSPACE_KEY}-cloud-account`;
const GUEST_WORKSPACE_KEY = `${WORKSPACE_KEY}-guest`;
const ACCOUNT_WORKSPACE_KEY_PREFIX = `${WORKSPACE_KEY}-account-`;
const MAX_CONFLICT_RETRIES = 3;

export interface RemoteWorkspace {
  state: unknown;
  stateHash: string;
}

export interface WorkspaceSaveResult {
  saved: boolean;
  state: unknown | null;
  stateHash: string | null;
}

export interface WorkspaceCloudClient {
  load(): Promise<RemoteWorkspace | null>;
  save(
    workspace: Workspace,
    stateHash: string,
    expectedHash: string | null,
  ): Promise<WorkspaceSaveResult>;
}

type SetStatus = (status: WorkspaceSyncStatus) => void;

function accountWorkspaceKey(userId: string): string {
  return `${ACCOUNT_WORKSPACE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function saveLocalSnapshot(key: string, workspace: Workspace): void {
  try {
    localStorage.setItem(key, JSON.stringify(workspace));
  } catch (error) {
    throw new Error(`Could not preserve local workspace data: ${errorMessage(error)}`);
  }
}

function readLocalSnapshot(key: string): Workspace | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    throw new Error(`Could not read the local workspace backup: ${errorMessage(error)}`);
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("A saved account workspace backup is not valid JSON.");
  }
  if (!isWorkspace(parsed)) {
    throw new Error("A saved account workspace backup has an unsupported format.");
  }
  return parsed;
}

function setAccountMarker(userId: string): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, userId);
  } catch (error) {
    throw new Error(`Could not record the active workspace account: ${errorMessage(error)}`);
  }
}

/** Isolates the active local workspace when a different account signs in. */
export function activateWorkspaceAccount(store: AppStore, userId: string): void {
  let previousAccount: string | null;
  try {
    previousAccount = localStorage.getItem(ACCOUNT_KEY);
  } catch (error) {
    throw new Error(`Could not determine the local workspace account: ${errorMessage(error)}`);
  }
  if (previousAccount === userId) return;

  const current = store.get(workspaceAtom);
  if (previousAccount && previousAccount !== "guest") {
    saveLocalSnapshot(accountWorkspaceKey(previousAccount), current);
  } else {
    saveLocalSnapshot(GUEST_WORKSPACE_KEY, current);
  }

  const restored =
    previousAccount === null
      ? null
      : (readLocalSnapshot(accountWorkspaceKey(userId)) ??
        readLocalSnapshot(GUEST_WORKSPACE_KEY) ??
        emptyWorkspace());
  setAccountMarker(userId);
  if (restored) store.set(workspaceAtom, restored);
}

/** Saves the signed-in copy and removes it from the guest-visible workspace. */
export function deactivateWorkspaceAccount(store: AppStore, userId: string): void {
  let activeAccount: string | null;
  try {
    activeAccount = localStorage.getItem(ACCOUNT_KEY);
  } catch (error) {
    throw new Error(`Could not determine the local workspace account: ${errorMessage(error)}`);
  }
  if (activeAccount !== userId) return;

  saveLocalSnapshot(accountWorkspaceKey(userId), store.get(workspaceAtom));
  const guestWorkspace = readLocalSnapshot(GUEST_WORKSPACE_KEY) ?? emptyWorkspace();
  setAccountMarker("guest");
  store.set(workspaceAtom, guestWorkspace);
}

export function deactivateStoredWorkspaceAccount(store: AppStore): void {
  let activeAccount: string | null;
  try {
    activeAccount = localStorage.getItem(ACCOUNT_KEY);
  } catch (error) {
    throw new Error(`Could not determine the local workspace account: ${errorMessage(error)}`);
  }
  if (activeAccount && activeAccount !== "guest") {
    deactivateWorkspaceAccount(store, activeAccount);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function parseRemoteWorkspace(value: unknown): Workspace {
  const legacyProject = migrateLegacySession(value);
  if (!isWorkspace(value) && !legacyProject) {
    throw new Error("The cloud workspace has an unsupported or invalid format.");
  }
  const workspace = isWorkspace(value)
    ? value
    : {
        version: 1 as const,
        activeProjectId: legacyProject?.id ?? null,
        projects: legacyProject ? [legacyProject] : [],
      };
  return {
    ...workspace,
    projects: workspace.projects.map((project) => ({
      ...project,
      state: parseProjectState(project.state),
    })),
  };
}

async function hashWorkspace(workspace: Workspace): Promise<string> {
  const serialized = JSON.stringify(workspace);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function startWorkspaceSync(
  store: AppStore,
  client: WorkspaceCloudClient,
  setStatus: SetStatus,
): { stop: () => void; retry: () => void } {
  let disposed = false;
  let initialized = false;
  let initializing = false;
  let flushing = false;
  let currentHash: string | null = null;
  let queuedWorkspace: Workspace | null = null;

  const status = (value: WorkspaceSyncStatus) => {
    if (!disposed) setStatus(value);
  };

  const flush = async () => {
    if (disposed || !initialized || flushing || !queuedWorkspace) return;
    if (!isOnline()) {
      status({ state: "pending", message: "Changes will sync when you're back online." });
      return;
    }

    flushing = true;
    let conflictRetries = 0;
    try {
      while (!disposed && queuedWorkspace) {
        const snapshot = queuedWorkspace;
        queuedWorkspace = null;
        status({ state: "syncing" });

        const stateHash = await hashWorkspace(snapshot);
        const result = await client.save(snapshot, stateHash, currentHash);
        if (disposed) return;

        if (result.saved) {
          if (!result.stateHash)
            throw new Error("Supabase did not return the saved workspace hash.");
          currentHash = result.stateHash;
          conflictRetries = 0;
          if (!queuedWorkspace) status({ state: "synced", syncedAt: Date.now() });
          continue;
        }

        conflictRetries += 1;
        if (conflictRetries > MAX_CONFLICT_RETRIES) {
          throw new Error("The workspace kept changing on another device. Retry sync to continue.");
        }

        currentHash = result.stateHash;
        if (result.state !== null) {
          const remoteWorkspace = parseRemoteWorkspace(result.state);
          const localWorkspace = queuedWorkspace ?? store.get(workspaceAtom);
          const merged = mergeWorkspace(localWorkspace, remoteWorkspace);
          if (merged !== localWorkspace) store.set(workspaceAtom, merged);
        }
        queuedWorkspace = store.get(workspaceAtom);
      }
    } catch (error) {
      queuedWorkspace = store.get(workspaceAtom);
      status(
        isOnline()
          ? { state: "error", message: errorMessage(error) }
          : { state: "pending", message: "Changes will sync when you're back online." },
      );
    } finally {
      flushing = false;
    }
  };

  const initialize = async () => {
    if (disposed || initializing || initialized) return;
    if (!isOnline()) {
      status({ state: "pending", message: "Workspace sync will start when you're back online." });
      return;
    }
    initializing = true;
    status({ state: "syncing" });
    try {
      const remote = await client.load();
      if (disposed) return;

      const localWorkspace = store.get(workspaceAtom);
      if (remote) {
        const remoteWorkspace = parseRemoteWorkspace(remote.state);
        currentHash = remote.stateHash;
        const merged = mergeWorkspace(localWorkspace, remoteWorkspace);
        if (merged !== localWorkspace) store.set(workspaceAtom, merged);
        initialized = true;
        if (merged === localWorkspace && queuedWorkspace === null) {
          status({ state: "synced", syncedAt: Date.now() });
          return;
        }
      } else {
        currentHash = null;
        initialized = true;
      }
      queuedWorkspace = store.get(workspaceAtom);
      await flush();
    } catch (error) {
      status(
        isOnline()
          ? { state: "error", message: errorMessage(error) }
          : { state: "pending", message: "Workspace sync will start when you're back online." },
      );
    } finally {
      initializing = false;
    }
  };

  const unsubscribe = store.sub(workspaceAtom, () => {
    queuedWorkspace = store.get(workspaceAtom);
    if (!initialized) return;
    if (!isOnline()) {
      status({ state: "pending", message: "Changes will sync when you're back online." });
      return;
    }
    void flush();
  });

  const onOnline = () => {
    if (!initialized) void initialize();
    else void flush();
  };
  window.addEventListener("online", onOnline);

  const retry = () => {
    if (initialized) void flush();
    else void initialize();
  };

  void initialize();

  return {
    retry,
    stop() {
      disposed = true;
      unsubscribe();
      window.removeEventListener("online", onOnline);
    },
  };
}
