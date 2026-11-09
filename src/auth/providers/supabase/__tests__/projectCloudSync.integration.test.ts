import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createStore } from "jotai";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { startProjectCloudSync } from "@/workspace/projectCloudSync";
import { WORKSPACE_KEY } from "@/workspace/storage";
import { emptyProjectState, newProjectRecord } from "@/workspace/types";
import { addProject, deleteProject, updateProject } from "@/workspace/workspace";

const auth = vi.hoisted(() => ({ session: null as Session | null }));
vi.mock("../client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: auth.session }, error: null }) },
  },
}));

import { createProjectCloudClient } from "../projectClient";

describe.runIf(process.env.LOCAL_SUPABASE_INTEGRATION === "true")(
  "local Supabase authenticated project sync",
  () => {
    let admin: SupabaseClient;
    let owner: Session;
    let other: Session;
    const userIds: string[] = [];
    const stops: (() => void)[] = [];
    let url: string;
    let key: string;

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
      const options = { auth: { persistSession: false, autoRefreshToken: false } };
      admin = createClient(url, serviceKey, options);
      const createSession = async () => {
        const email = `milestone2-${crypto.randomUUID()}@example.test`;
        const password = `${crypto.randomUUID()}Aa1!`;
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (created.error || !created.data.user)
          throw created.error ?? new Error("User creation failed.");
        userIds.push(created.data.user.id);
        const client = createClient(url, key, options);
        const signedIn = await client.auth.signInWithPassword({ email, password });
        if (signedIn.error || !signedIn.data.session)
          throw signedIn.error ?? new Error("Sign-in failed.");
        return signedIn.data.session;
      };
      owner = await createSession();
      other = await createSession();
      auth.session = owner;
      localStorage.clear();
    });

    afterAll(async () => {
      for (const stop of stops) stop();
      auth.session = null;
      for (const id of userIds) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
      }
      vi.unstubAllEnvs();
    });

    it("saves individual drafts, merges CAS races, isolates owners and deletes conditionally", async () => {
      const store = createStore();
      const client = createProjectCloudClient(owner.user.id);
      const sync = startProjectCloudSync(store, client);
      stops.push(sync.stop);
      await sync.load();
      expect(store.get(workspaceAtom).projects).toEqual([]);
      const first = newProjectRecord({
        ...emptyProjectState(),
        projectData: { project_id: "integration-first", name: "First" },
      });
      const second = newProjectRecord({
        ...emptyProjectState(),
        projectData: { project_id: "integration-second", name: "Second" },
      });
      store.set(workspaceAtom, (workspace) => addProject(addProject(workspace, first), second));
      await sync.flush();
      expect(
        (await client.load())
          .map((row) => ("project" in row ? row.project.id : row.projectId))
          .sort(),
      ).toEqual([first.id, second.id].sort());

      const device = createStore();
      const deviceSync = startProjectCloudSync(device, createProjectCloudClient(owner.user.id));
      stops.push(deviceSync.stop);
      await deviceSync.load();
      store.set(workspaceAtom, (workspace) =>
        updateProject(workspace, first.id, {
          ...first.state,
          projectData: { ...first.state.projectData, description: "device one" },
        }),
      );
      await sync.flush();
      device.set(workspaceAtom, (workspace) =>
        updateProject(workspace, first.id, {
          ...first.state,
          projectData: { ...first.state.projectData, name: "device two" },
        }),
      );
      await deviceSync.flush();
      const saved = (await client.load())
        .filter((row) => "project" in row)
        .find((row) => row.project.id === first.id);
      expect(saved?.project.state.projectData).toMatchObject({
        name: "device two",
        description: "device one",
      });
      expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();

      auth.session = other;
      const isolated = createProjectCloudClient(other.user.id);
      expect(await isolated.load()).toEqual([]);
      await expect(client.save(first, "bad-account", null)).rejects.toThrow("account changed");
      const sameId = {
        ...first,
        state: {
          ...first.state,
          projectData: { project_id: "other-owner", name: "Private other owner" },
        },
      };
      expect((await isolated.save(sameId, "other-owner-hash", null)).saved).toBe(true);

      const anonymous = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const anonRead = await anonymous.from("metadata_builder_sessions").select("project_id");
      expect(anonRead.error).not.toBeNull();
      const anonWrite = await anonymous.rpc("save_metadata_builder_session", {
        p_project_id: first.id,
        p_state: first,
        p_state_hash: "anon",
        p_expected_hash: null,
      });
      expect(anonWrite.error).not.toBeNull();
      auth.session = owner;
      await sync.remove(first.id);
      await deviceSync.remove(first.id);
      device.set(workspaceAtom, (workspace) => deleteProject(workspace, first.id));
      await deviceSync.flush();
      expect(
        (await client.load()).map((row) => ("project" in row ? row.project.id : row.projectId)),
      ).toEqual([second.id]);
      auth.session = other;
      expect(
        (await isolated.load()).map((row) => ("project" in row ? row.project.id : row.projectId)),
      ).toEqual([first.id]);
    });

    it("protects a newer draft from an old device even with the latest hash", async () => {
      auth.session = owner;
      const client = createProjectCloudClient(owner.user.id);
      const first = newProjectRecord();
      const second = newProjectRecord();
      await client.save(first, "version-one", null);
      await client.save(second, "supported", null);
      const store = createStore();
      const sync = startProjectCloudSync(store, client);
      stops.push(sync.stop);
      await sync.load();

      const newer = createClient(url, key, {
        accessToken: async () => owner.access_token,
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const future = {
        id: first.id,
        schemaVersion: 2,
        newEnvelopeField: { keep: true },
        state: { newDraftField: ["must survive"], nextExperimentId: "new representation" },
      };
      const upgraded = await newer.rpc("save_metadata_builder_session", {
        p_project_id: first.id,
        p_state: future,
        p_state_hash: "version-two",
        p_expected_hash: "version-one",
      });
      expect(upgraded.error).toBeNull();
      for (const project of [first, second]) {
        store.set(workspaceAtom, (workspace) =>
          updateProject(workspace, project.id, {
            ...project.state,
            projectData: { name: "old device edit" },
          }),
        );
      }
      await expect(sync.flush()).rejects.toThrow("Reload");
      await expect(client.save(first, "old-with-latest-hash", "version-two")).rejects.toThrow(
        "Reload",
      );
      const stored = await newer
        .from("metadata_builder_sessions")
        .select("state, state_hash")
        .eq("project_id", first.id)
        .single();
      expect(stored.error).toBeNull();
      expect(stored.data).toEqual({ state: future, state_hash: "version-two" });
      const supported = await newer
        .from("metadata_builder_sessions")
        .select("state")
        .eq("project_id", second.id)
        .single();
      expect(supported.error).toBeNull();
      expect(supported.data?.state.state.projectData.name).toBe("old device edit");
      expect(await client.load()).toContainEqual({ projectId: first.id, schemaVersion: 2 });
    });
  },
);
