import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMetadataDocument } from "../exportImport";

describe("buildMetadataDocument", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records the builder version it was built from", () => {
    vi.stubEnv("VITE_BUILDER_VERSION", "1.1.0+dev.ac24e9a");
    expect(buildMetadataDocument({}, [], []).metadata_builder_version).toBe("1.1.0+dev.ac24e9a");
  });
});
