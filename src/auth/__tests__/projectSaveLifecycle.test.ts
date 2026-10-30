import { beforeEach, describe, expect, it, vi } from "vitest";
import { appStore } from "@/state/store";
import { ProjectConflictError, projectSyncActionsAtom } from "@/workspace/syncState";

const adapter = vi.hoisted(() => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("../config", () => ({ authEnabled: true, authProvider: "supabase" }));
vi.mock("../providers/supabase/adapter", () => ({ supabaseAuthClient: adapter }));

import { createAuthClient } from "../index";

describe("authenticated project save lifecycle", () => {
  const flush = vi.fn();
  const stop = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    flush.mockResolvedValue(undefined);
    adapter.signOut.mockResolvedValue(undefined);
    adapter.deleteAccount.mockResolvedValue({});
    appStore.set(projectSyncActionsAtom, {
      flush,
      refresh: vi.fn(),
      discardProjectChanges: vi.fn(),
      keepProjectChanges: vi.fn(),
      stop,
      remove: vi.fn(),
      migrateLocalProjects: vi.fn(),
    });
  });

  it("awaits save acknowledgement before signing out", async () => {
    const calls: string[] = [];
    flush.mockImplementation(async () => {
      calls.push("flush");
    });
    adapter.signOut.mockImplementation(async () => {
      calls.push("signOut");
    });
    await createAuthClient().signOut();
    expect(calls).toEqual(["flush", "signOut"]);
  });

  it("does not sign out when the project save fails", async () => {
    flush.mockRejectedValue(new Error("not saved"));
    await expect(createAuthClient().signOut()).rejects.toThrow("not saved");
    expect(adapter.signOut).not.toHaveBeenCalled();
  });

  it("allows sign-out after a project conflict without deleting the preserved draft", async () => {
    flush.mockRejectedValue(new ProjectConflictError("project", "Conflict"));
    await createAuthClient().signOut();
    expect(adapter.signOut).toHaveBeenCalledOnce();
  });

  it("flushes before account deletion and does not flush deleted rows at local sign-out", async () => {
    const client = createAuthClient();
    await client.deleteAccount();
    expect(flush).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(appStore.get(projectSyncActionsAtom)).toBeNull();
    flush.mockRejectedValue(new Error("deleted account cannot save"));
    await client.signOut("local");
    expect(flush).toHaveBeenCalledOnce();
    expect(adapter.signOut).toHaveBeenCalledWith("local");
  });

  it("keeps persistence active if account deletion fails", async () => {
    adapter.deleteAccount.mockResolvedValue({ error: { message: "denied" } });
    await createAuthClient().deleteAccount();
    expect(stop).not.toHaveBeenCalled();
    expect(appStore.get(projectSyncActionsAtom)).not.toBeNull();
  });
});
