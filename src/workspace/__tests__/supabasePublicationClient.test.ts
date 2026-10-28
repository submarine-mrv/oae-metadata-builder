import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProjectPublicationPayload } from "../publicationPayload";
import { createPublicationClient } from "../supabasePublicationClient";
import { publicationProject } from "./publicationFixtures";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  owner: vi.fn(),
}));
vi.mock("@/auth/providers/supabase/ownerClient", () => ({
  createOwnerClient: (owner: string) => {
    mocks.owner(owner);
    return {
      from: () => ({
        select: () => ({
          eq: (...args: unknown[]) => {
            mocks.eq(...args);
            return {
              eq: (...args: unknown[]) => {
                mocks.eq(...args);
                return { maybeSingle: mocks.single };
              },
            };
          },
        }),
      }),
      rpc: mocks.rpc,
    };
  },
}));

describe("owner-bound publication client", () => {
  const payload = buildProjectPublicationPayload(publicationProject());
  const timestamp = "2026-10-28T00:00:00Z";
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.single.mockResolvedValue({ data: null, error: null });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result_project_id: "PUBLICATION-TEST",
          result_published_at: timestamp,
          result_experiment_count: 1,
          result_dataset_count: 1,
        },
      ],
      error: null,
    });
  });

  it("looks up the owner and stable internal draft identity, not an editable public ID", async () => {
    expect(await createPublicationClient("owner").status("draft-id")).toBeNull();
    expect(mocks.owner).toHaveBeenCalledWith("owner");
    expect(mocks.eq.mock.calls).toEqual([
      ["owner_id", "owner"],
      ["builder_project_id", "draft-id"],
    ]);
  });

  it("publishes the complete normalized payload and validates the server acknowledgement", async () => {
    const result = await createPublicationClient("owner").publish("draft-id", payload);
    expect(mocks.rpc).toHaveBeenCalledWith("publish_oae_project", {
      p_source_project_id: "draft-id",
      p_project: payload.project,
      p_experiments: payload.experiments,
      p_datasets: payload.datasets,
    });
    expect(result).toEqual({
      projectId: "PUBLICATION-TEST",
      published: true,
      updatedAt: timestamp,
    });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result_project_id: "PUBLICATION-TEST",
          result_published_at: timestamp,
          result_experiment_count: 0,
          result_dataset_count: 1,
        },
      ],
      error: null,
    });
    await expect(createPublicationClient("owner").publish("draft-id", payload)).rejects.toThrow(
      "invalid publication response",
    );
  });

  it("unpublishes using the stable draft identity and rejects missing publications", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await createPublicationClient("owner").unpublish("draft-id");
    expect(mocks.rpc).toHaveBeenCalledWith("unpublish_oae_project", {
      p_source_project_id: "draft-id",
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
    await expect(client.publish("draft", payload)).rejects.toThrow("ID conflict");
    await expect(client.unpublish("draft")).rejects.toThrow("ID conflict");
  });
});
