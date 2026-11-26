import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createStore } from "jotai";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { publicationProject } from "@/workspace/__tests__/publicationFixtures";
import { ProjectAccessError, startProjectCloudSync } from "@/workspace/projectCloudSync";
import { buildProjectPublicationPayload } from "@/workspace/publicationPayload";
import { WORKSPACE_KEY } from "@/workspace/storage";
import { createPublicationClient } from "@/workspace/supabasePublicationClient";
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
      // Project ids are global: a non-member can't claim an existing one.
      await expect(isolated.save(sameId, "other-owner-hash", null)).rejects.toThrow(
        ProjectAccessError,
      );

      const anonymous = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const anonRead = await anonymous.from("mb_project").select("project_uuid");
      expect(anonRead.error).not.toBeNull();
      const anonWrite = await anonymous.rpc("save_metadata_builder_session", {
        p_project_uuid: first.id,
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
      expect(await isolated.load()).toEqual([]);
    });

    it("saves duplicate human IDs in drafts without reserving them", async () => {
      auth.session = owner;
      const suffix = crypto.randomUUID().slice(0, 8);
      const taken = newProjectRecord({
        ...emptyProjectState(),
        projectData: { project_id: `Site-${suffix}` },
      });
      await createProjectCloudClient(owner.user.id).save(taken, `taken-${suffix}`, null);

      auth.session = other;
      try {
        const client = createProjectCloudClient(other.user.id);
        const draft = (id: string) =>
          newProjectRecord({ ...emptyProjectState(), projectData: { project_id: id } });
        const duplicate = draft(`SITE-${suffix}`);
        expect((await client.save(duplicate, "duplicate", null)).saved).toBe(true);
        expect((await client.save(draft(` Site ${suffix} / #1`), "any", null)).saved).toBe(true);
        expect((await client.save(draft(""), "empty", null)).saved).toBe(true);
      } finally {
        auth.session = owner;
      }
    });

    it("resolves mixed field choices through normalized project and dataset storage", async () => {
      auth.session = owner;
      const client = createProjectCloudClient(owner.user.id);
      const project = { ...publicationProject(), id: crypto.randomUUID() };
      await client.save(project, "conflict-base", null);
      const store = createStore();
      const sync = startProjectCloudSync(store, client);
      stops.push(sync.stop);
      await sync.load();

      const incoming = structuredClone(project);
      incoming.state.projectData.name = "Incoming project name";
      incoming.state.datasets[0].formData.description = "Incoming dataset description";
      await client.save(incoming, "conflict-incoming", "conflict-base");
      const local = structuredClone(project.state);
      local.projectData.name = "My project name";
      local.datasets[0].formData.description = "My dataset description";
      store.set(workspaceAtom, (workspace) => updateProject(workspace, project.id, local));
      await expect(sync.flush()).rejects.toThrow();

      const conflicts = await sync.previewProjectConflict(project.id);
      expect(conflicts).toHaveLength(2);
      await sync.resolveProjectConflict(
        project.id,
        Object.fromEntries(
          conflicts.map((conflict) => [
            conflict.key,
            conflict.kind === "project" ? "local" : "remote",
          ]),
        ),
        conflicts,
      );
      const saved = (await client.load()).find(
        (row) => "project" in row && row.project.id === project.id,
      );
      expect(saved).toMatchObject({
        project: {
          state: {
            projectData: { name: "My project name" },
            datasets: [{ formData: { description: "Incoming dataset description" } }],
          },
        },
      });
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
        schemaVersion: 3,
        newEnvelopeField: { keep: true },
        state: { newDraftField: ["must survive"], nextExperimentId: "new representation" },
      };
      const upgraded = await newer.rpc("save_metadata_builder_session", {
        p_project_uuid: first.id,
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
      // Signed-in clients can't read the table directly, so inspect it as the admin.
      const stored = await admin
        .from("mb_project")
        .select("state, state_hash")
        .eq("project_uuid", first.id)
        .single();
      expect(stored.error).toBeNull();
      expect(stored.data).toEqual({ state: future, state_hash: "version-two" });
      const supported = await admin
        .from("mb_project")
        .select("state")
        .eq("project_uuid", second.id)
        .single();
      expect(supported.error).toBeNull();
      expect(supported.data?.state.state.projectData.name).toBe("old device edit");
      expect(await client.load()).toContainEqual(
        expect.objectContaining({ projectId: first.id, schemaVersion: 3 }),
      );
    });

    it("publishes, updates, renames, unpublishes and republishes without exposing private edits", async () => {
      auth.session = owner;
      const drafts = createProjectCloudClient(owner.user.id);
      const publication = createPublicationClient(owner.user.id);
      const project = publicationProject();
      const suffix = crypto.randomUUID();
      project.id = `publication-${suffix}`;
      project.state.projectData.project_id = `PUBLICATION-${suffix}`;
      project.state.experiments[0].formData.project_id = project.state.projectData.project_id;
      project.state.experiments[0].formData.experiment_id = `EXP-${suffix}`;
      project.state.datasets[0].formData.project_id = project.state.projectData.project_id;
      project.state.datasets[0].formData.experiment_id = `EXP-${suffix}`;
      expect((await drafts.save(project, "publication-v1", null)).saved).toBe(true);
      expect(await publication.status(project.id)).toBeNull();
      const anonymous = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const readTree = async (projectId: string) => {
        const { data, error } = await anonymous
          .from("projects")
          .select("document")
          .eq("project_id", projectId)
          .maybeSingle();
        expect(error).toBeNull();
        const document = data?.document;
        return document
          ? [[document.project], document.experiments ?? [], document.datasets ?? []]
          : [[], [], []];
      };
      const publicId = project.state.projectData.project_id;
      expect((await readTree(publicId)).map((rows) => rows.length)).toEqual([0, 0, 0]);
      await publication.publish(project.id, buildProjectPublicationPayload(project));
      const firstTree = await readTree(publicId);
      expect(firstTree.map((rows) => rows.length)).toEqual([1, 1, 1]);
      expect(firstTree[2][0]).toEqual(project.state.datasets[0].formData);
      await expect(drafts.remove(project.id, "publication-v1")).rejects.toThrow("Unpublish");

      const edited = structuredClone(project);
      edited.state.projectData.description = "Private edit until explicitly published";
      expect((await drafts.save(edited, "publication-v2", "publication-v1")).saved).toBe(true);
      expect((await readTree(publicId))[0][0].description).toBe(
        project.state.projectData.description,
      );
      await publication.publish(edited.id, buildProjectPublicationPayload(edited));
      expect((await readTree(publicId))[0][0].description).toBe(
        edited.state.projectData.description,
      );

      auth.session = other;
      const foreign = { ...edited, id: `foreign-${suffix}` };
      // Drafts may reuse published IDs, but publication still rejects them.
      expect(
        (await createProjectCloudClient(other.user.id).save(foreign, "foreign-v1", null)).saved,
      ).toBe(true);
      await expect(
        createPublicationClient(other.user.id).publish(
          foreign.id,
          buildProjectPublicationPayload(foreign),
        ),
      ).rejects.toThrow();
      await expect(createPublicationClient(other.user.id).unpublish(project.id)).rejects.toThrow(
        "No matching",
      );
      await expect(
        publication.publish(edited.id, buildProjectPublicationPayload(edited)),
      ).rejects.toThrow("account changed");
      auth.session = owner;

      const renamed = structuredClone(edited);
      renamed.state.projectData.project_id = `RENAMED-${suffix}`;
      renamed.state.experiments[0].formData.project_id = renamed.state.projectData.project_id;
      renamed.state.datasets[0].formData.project_id = renamed.state.projectData.project_id;
      await drafts.save(renamed, "publication-v3", "publication-v2");
      await publication.publish(renamed.id, buildProjectPublicationPayload(renamed));
      expect((await readTree(publicId)).map((rows) => rows.length)).toEqual([0, 0, 0]);
      expect((await publication.status(project.id))?.projectId).toBe(
        renamed.state.projectData.project_id,
      );
      await publication.unpublish(project.id);
      expect(
        (await readTree(renamed.state.projectData.project_id)).map((rows) => rows.length),
      ).toEqual([0, 0, 0]);
      expect(
        (await drafts.load()).some((row) => "project" in row && row.project.id === project.id),
      ).toBe(true);
      await publication.publish(renamed.id, buildProjectPublicationPayload(renamed));
      expect(
        (await readTree(renamed.state.projectData.project_id)).map((rows) => rows.length),
      ).toEqual([1, 1, 1]);
      const trimmed = {
        ...renamed,
        state: { ...renamed.state, experiments: [], datasets: [] },
      };
      await drafts.save(trimmed, "publication-v4", "publication-v3");
      await publication.publish(trimmed.id, buildProjectPublicationPayload(trimmed));
      expect(
        (await readTree(renamed.state.projectData.project_id)).map((rows) => rows.length),
      ).toEqual([1, 0, 0]);
      await publication.unpublish(project.id);
      expect((await drafts.remove(project.id, "publication-v4")).saved).toBe(true);
    });

    it.each([
      "project",
      "experiment",
      "cross-kind",
    ])("serializes competing case-insensitive %s ID claims and retains unpublished reservations", async (kind) => {
      const suffix = crypto.randomUUID();
      const contenders = await Promise.all(
        [owner, other].map(async (session, index) => {
          const api = createClient(url, key, {
            accessToken: async () => session.access_token,
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const draft = { ...publicationProject(), id: crypto.randomUUID() };
          const projectId =
            kind === "project" || (kind === "cross-kind" && index === 0)
              ? `Race-${suffix}`
              : `Race-${index}-${suffix}`;
          const experimentId =
            kind === "cross-kind" && index === 1
              ? `Race-${suffix}`
              : kind === "experiment"
                ? `Exp-${suffix}`
                : `Exp-${index}-${suffix}`;
          draft.state.projectData.project_id = index === 1 ? projectId.toLowerCase() : projectId;
          draft.state.experiments[0].formData.project_id = draft.state.projectData.project_id;
          draft.state.datasets[0].formData.project_id = draft.state.projectData.project_id;
          draft.state.experiments[0].formData.experiment_id =
            index === 1 ? experimentId.toLowerCase() : experimentId;
          draft.state.datasets[0].formData.experiment_id =
            draft.state.experiments[0].formData.experiment_id;
          const saved = await api.rpc("save_metadata_builder_session", {
            p_project_uuid: draft.id,
            p_state: draft,
            p_state_hash: "race",
          });
          expect(saved.error).toBeNull();
          const payload = buildProjectPublicationPayload(draft);
          const publish = () =>
            api.rpc("publish_oae_project", {
              p_source_project_uuid: draft.id,
              p_project: payload.project,
              p_experiments: payload.experiments,
              p_datasets: payload.datasets,
            });
          return { api, draft, publish };
        }),
      );
      const outcomes = await Promise.all(contenders.map((contender) => contender.publish()));
      expect(outcomes.filter((result) => result.error === null)).toHaveLength(1);
      const failure = outcomes.find((result) => result.error)?.error;
      expect(failure?.code).toBe("23505");
      expect(failure?.details).toBe("oae_duplicate_ids");
      const loser = outcomes[0].error ? 0 : 1;
      const conflictingKind =
        kind === "cross-kind" ? (loser === 0 ? "project" : "experiment") : kind;
      const losingDraft = contenders[loser].draft;
      expect(JSON.parse(failure?.hint ?? "null")).toEqual([
        {
          entity_type: conflictingKind,
          id:
            conflictingKind === "experiment"
              ? losingDraft.state.experiments[0].formData.experiment_id
              : losingDraft.state.projectData.project_id,
        },
      ]);
      const winner = outcomes.findIndex((result) => result.error === null);
      const unpublished = await contenders[winner].api.rpc("unpublish_oae_project", {
        p_source_project_uuid: contenders[winner].draft.id,
      });
      expect(unpublished.error).toBeNull();
      expect((await contenders[1 - winner].publish()).error?.code).toBe("23505");
    });
  },
);
