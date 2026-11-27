import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicationClient, PublicationChangedError } from "../supabasePublicationClient";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  account: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/auth/providers/supabase/projectClient", () => ({
  createAccountClient: (account: string, keepaliveRequests?: boolean) => {
    mocks.account(account, keepaliveRequests);
    return {
      from: () => ({
        select: () => ({
          in: mocks.list,
          eq: (...args: unknown[]) => {
            mocks.eq(...args);
            return { in: mocks.list, maybeSingle: mocks.single };
          },
        }),
      }),
      rpc: mocks.rpc,
    };
  },
}));

describe("owner-bound publication client", () => {
  const timestamp = "2026-10-28T00:00:00Z";
  const document = { project: { project_id: "PUBLICATION-TEST" }, experiments: [], datasets: [] };
  const live = (versionNo = 1) => ({
    data: {
      project_id: "PUBLICATION-TEST",
      version_no: versionNo,
      published_at: timestamp,
      document,
    },
    error: null,
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.single.mockResolvedValue({ data: null, error: null });
    mocks.list.mockResolvedValue({ data: [{ project_uuid: "draft-id" }], error: null });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result_project_id: "PUBLICATION-TEST",
          result_version_no: 1,
          result_published_at: timestamp,
          result_experiment_count: 1,
          result_dataset_count: 1,
        },
      ],
      error: null,
    });
  });

  it("checks proposed IDs without saving or changing a draft", async () => {
    const conflicts = [{ entity_type: "experiment", id: "TAKEN", reason: "in_use" }];
    const experiments = [{ uuid: "experiment-uuid", id: "TAKEN" }];
    mocks.rpc.mockResolvedValue({ data: conflicts, error: null });
    expect(
      await createPublicationClient("owner").checkIds("draft-id", "FREE", experiments),
    ).toEqual(conflicts);
    expect(mocks.rpc).toHaveBeenCalledWith("check_metadata_builder_id_availability", {
      p_project_uuid: "draft-id",
      p_project_id: "FREE",
      p_experiments: experiments,
    });
    await createPublicationClient("owner").checkIds("draft-id");
    expect(mocks.rpc).toHaveBeenLastCalledWith("check_metadata_builder_id_availability", {
      p_project_uuid: "draft-id",
      p_project_id: null,
      p_experiments: null,
    });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(createPublicationClient("owner").checkIds("draft-id", "FREE", [])).rejects.toThrow(
      "offline",
    );
    mocks.rpc.mockResolvedValue({
      data: [{ entity_type: "project", id: "someone-else" }],
      error: null,
    });
    await expect(createPublicationClient("owner").checkIds("draft-id", "FREE", [])).rejects.toThrow(
      "invalid ID availability",
    );
  });

  it("explains final publication conflicts even after a prior availability check", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        details: "oae_duplicate_ids",
        message: "duplicate",
        hint: '[{"entity_type":"project","id":"PUBLICATION-TEST","reason":"in_use"}]',
      },
    });
    await expect(createPublicationClient("owner").publish("draft-id", "hash")).rejects.toThrow(
      'Project ID "PUBLICATION-TEST" is already in use. Choose unique IDs before publishing. Your draft is saved.',
    );
  });

  it("asks to sync first when the draft changed since the reviewed hash", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { details: "metadata_builder_project_changed", message: "changed" },
    });
    await expect(createPublicationClient("owner").publish("draft-id", "hash")).rejects.toThrow(
      PublicationChangedError,
    );
  });

  it("looks up the stable internal draft identity, not an editable public ID", async () => {
    expect(await createPublicationClient("owner").status("draft-id")).toBeNull();
    expect(mocks.account).toHaveBeenCalledWith("owner", false);
    expect(mocks.eq.mock.calls).toEqual([["project_uuid", "draft-id"]]);
  });

  it("loads published draft IDs in one request, including visible shared projects", async () => {
    const client = createPublicationClient("owner");
    expect(await client.publishedProjectIds(["draft-id", "private-draft"])).toEqual(["draft-id"]);
    expect(mocks.eq).not.toHaveBeenCalledWith("published", true);
    expect(mocks.list).toHaveBeenCalledWith("project_uuid", ["draft-id", "private-draft"]);
    mocks.list.mockClear();
    expect(await client.publishedProjectIds([])).toEqual([]);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("loads the persisted metadata document for comparison after a reload", async () => {
    mocks.single.mockResolvedValue(live(2));
    expect(await createPublicationClient("owner").status("draft-id")).toEqual({
      projectId: "PUBLICATION-TEST",
      published: true,
      updatedAt: timestamp,
      versionNo: 2,
      document,
    });
    mocks.single.mockResolvedValue({
      data: { project_id: "PUBLICATION-TEST", published_at: timestamp, document },
      error: null,
    });
    await expect(createPublicationClient("owner").status("draft-id")).rejects.toThrow("invalid");
  });

  it("rejects failed or malformed publication listings", async () => {
    const client = createPublicationClient("owner");
    mocks.list.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(client.publishedProjectIds(["draft-id"])).rejects.toThrow("offline");
    mocks.list.mockResolvedValue({ data: [{ project_uuid: 123 }], error: null });
    await expect(client.publishedProjectIds(["draft-id"])).rejects.toThrow("invalid");
  });

  it("publishes the saved draft at the reviewed hash and returns the new live snapshot", async () => {
    mocks.single.mockResolvedValue(live(1));
    const result = await createPublicationClient("owner").publish("draft-id", "hash");
    expect(mocks.rpc).toHaveBeenCalledWith("publish_oae_project", {
      p_project_uuid: "draft-id",
      p_expected_project_hash: "hash",
    });
    expect(result).toEqual({
      projectId: "PUBLICATION-TEST",
      published: true,
      updatedAt: timestamp,
      versionNo: 1,
      document,
    });
  });

  it("rejects a malformed acknowledgement or a live snapshot from another publish", async () => {
    mocks.single.mockResolvedValue(live(2));
    await expect(createPublicationClient("owner").publish("draft-id", "hash")).rejects.toThrow(
      "changed again",
    );
    mocks.rpc.mockResolvedValue({
      data: [{ result_project_id: "PUBLICATION-TEST", result_published_at: timestamp }],
      error: null,
    });
    await expect(createPublicationClient("owner").publish("draft-id", "hash")).rejects.toThrow(
      "invalid publication response",
    );
  });

  it("unpublishes using the stable draft identity and rejects missing publications", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await createPublicationClient("owner").unpublish("draft-id");
    expect(mocks.rpc).toHaveBeenCalledWith("unpublish_oae_project", {
      p_project_uuid: "draft-id",
    });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(createPublicationClient("owner").unpublish("draft-id")).rejects.toThrow(
      "No matching",
    );
  });

  it("surfaces status and mutation failures and malformed responses", async () => {
    const client = createPublicationClient("owner");
    mocks.single.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(client.status("draft")).rejects.toThrow("offline");
    mocks.single.mockResolvedValue({ data: { published: true }, error: null });
    await expect(client.status("draft")).rejects.toThrow("invalid");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "ID conflict" } });
    await expect(client.publish("draft", "hash")).rejects.toThrow("ID conflict");
    await expect(client.unpublish("draft")).rejects.toThrow("ID conflict");
  });
});
