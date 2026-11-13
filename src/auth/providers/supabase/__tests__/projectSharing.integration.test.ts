import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createStore } from "jotai";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { ProjectAccessError, startProjectCloudSync } from "@/workspace/projectCloudSync";
import {
  ProjectConflictError,
  projectAccessAtom,
  remoteDeletionsAtom,
} from "@/workspace/syncState";
import { emptyProjectState, newProjectRecord } from "@/workspace/types";
import { addProject, updateProject } from "@/workspace/workspace";

const auth = vi.hoisted(() => ({ session: null as Session | null }));
vi.mock("../client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: auth.session }, error: null }) },
  },
}));

import { createProjectCloudClient, createProjectMembersClient } from "../projectClient";

describe.runIf(process.env.LOCAL_SUPABASE_INTEGRATION === "true")(
  "local Supabase project sharing",
  () => {
    let admin: SupabaseClient;
    let owner: Session;
    let editor: Session;
    const userIds: string[] = [];
    const stops: (() => void)[] = [];
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    let url: string;
    let key: string;

    const createSession = async (email = `sharing-${crypto.randomUUID()}@example.test`) => {
      const password = `${crypto.randomUUID()}Aa1!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user)
        throw created.error ?? new Error("User creation failed.");
      userIds.push(created.data.user.id);
      const signedIn = await createClient(url, key, options).auth.signInWithPassword({
        email,
        password,
      });
      if (signedIn.error || !signedIn.data.session)
        throw signedIn.error ?? new Error("Sign-in failed.");
      return signedIn.data.session;
    };

    /** Each sync engine runs as one user; requests use whichever session is active. */
    const startAs = async (session: Session) => {
      auth.session = session;
      const store = createStore();
      const sync = startProjectCloudSync(store, createProjectCloudClient(session.user.id));
      stops.push(sync.stop);
      await sync.load();
      return { store, sync };
    };

    const rename = (store: ReturnType<typeof createStore>, id: string, fields: object) => {
      const record = store.get(workspaceAtom).projects.find((project) => project.id === id);
      if (!record) throw new Error("missing project");
      store.set(workspaceAtom, (workspace) =>
        updateProject(workspace, id, {
          ...record.state,
          projectData: { ...record.state.projectData, ...fields },
        }),
      );
    };

    beforeAll(async () => {
      url = process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";
      if (new URL(url).hostname !== "127.0.0.1") {
        throw new Error("Integration tests may only run against explicitly local Supabase.");
      }
      key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY ?? "";
      const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
      if (!key || !serviceKey)
        throw new Error("Local Supabase integration credentials are required.");
      vi.stubEnv("VITE_SUPABASE_URL", url);
      vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", key);
      admin = createClient(url, serviceKey, options);
      owner = await createSession();
      editor = await createSession();
      localStorage.clear();
    });

    afterAll(async () => {
      for (const stop of stops) stop();
      auth.session = null;
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
      vi.unstubAllEnvs();
    });

    it("lets an editor merge, conflict, lose edit access and lose the project", async () => {
      const a = await startAs(owner);
      const shared = newProjectRecord({
        ...emptyProjectState(),
        projectData: { project_id: "shared", name: "Shared" },
      });
      a.store.set(workspaceAtom, (workspace) => addProject(workspace, shared));
      await a.sync.flush();
      const members = createProjectMembersClient(owner.user.id);
      await members.set(shared.id, editor.user.email ?? "", "editor");

      const b = await startAs(editor);
      expect(b.store.get(projectAccessAtom)[shared.id]).toMatchObject({ role: "editor" });

      // Different fields merge.
      auth.session = owner;
      rename(a.store, shared.id, { name: "Owner name" });
      await a.sync.flush();
      auth.session = editor;
      rename(b.store, shared.id, { description: "Editor description" });
      await b.sync.flush();
      auth.session = owner;
      await a.sync.refresh();
      expect(a.store.get(workspaceAtom).projects[0].state.projectData).toMatchObject({
        name: "Owner name",
        description: "Editor description",
      });
      expect(a.store.get(projectAccessAtom)[shared.id].updatedByEmail).toBe(
        editor.user.email?.toLowerCase(),
      );

      // The same field conflicts.
      rename(a.store, shared.id, { name: "Owner again" });
      await a.sync.flush();
      auth.session = editor;
      rename(b.store, shared.id, { name: "Editor rename" });
      await expect(b.sync.flush()).rejects.toThrow(ProjectConflictError);
      await b.sync.discardProjectChanges(shared.id);

      // Downgraded to viewer: the next save is refused, then refresh applies the role.
      auth.session = owner;
      await members.set(shared.id, editor.user.email ?? "", "viewer");
      auth.session = editor;
      rename(b.store, shared.id, { description: "After downgrade" });
      await expect(b.sync.flush()).rejects.toThrow(ProjectAccessError);
      await b.sync.refresh();
      expect(b.store.get(projectAccessAtom)[shared.id].role).toBe("viewer");
      expect(b.sync.hasPendingChanges()).toBe(false);
      expect(b.store.get(workspaceAtom).projects[0].state.projectData.description).not.toBe(
        "After downgrade",
      );

      // Removed: the project disappears with its own reason.
      auth.session = owner;
      await members.remove(shared.id, editor.user.email ?? "");
      auth.session = editor;
      await b.sync.refresh();
      expect(b.store.get(workspaceAtom).projects).toEqual([]);
      expect(b.store.get(remoteDeletionsAtom)).toContainEqual(
        expect.objectContaining({ projectId: shared.id, reason: "access" }),
      );
    });

    it("applies a grant made before the person had an account", async () => {
      const a = await startAs(owner);
      const project = newProjectRecord({ ...emptyProjectState(), projectData: { name: "Early" } });
      a.store.set(workspaceAtom, (workspace) => addProject(workspace, project));
      await a.sync.flush();
      const email = `later-${crypto.randomUUID()}@example.test`;
      await createProjectMembersClient(owner.user.id).set(project.id, email, "viewer");

      const later = await createSession(email);
      const c = await startAs(later);
      expect(c.store.get(workspaceAtom).projects.map((record) => record.id)).toEqual([project.id]);
      expect(c.store.get(projectAccessAtom)[project.id]).toMatchObject({
        role: "viewer",
        ownerEmail: owner.user.email?.toLowerCase(),
      });
    });
  },
);
