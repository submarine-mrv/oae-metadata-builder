import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMetadataDocument } from "../exportImport";

describe("buildMetadataDocument", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records the builder commit it was built from", () => {
    vi.stubEnv("VITE_BUILDER_GIT_HASH", "abc123");
    expect(buildMetadataDocument({}, [], []).metadata_builder_git_hash).toBe("abc123");
  });
});
