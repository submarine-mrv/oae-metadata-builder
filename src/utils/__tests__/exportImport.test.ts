import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMetadataDocument } from "../exportImport";
import { getProtocolVersion, getSchemaVersion } from "../schemaViews";

describe("buildMetadataDocument", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records the builder version it was built from", () => {
    vi.stubEnv("VITE_BUILDER_VERSION", "1.1.0+dev.ac24e9a");
    expect(buildMetadataDocument({}, [], []).metadata_builder_version).toBe("1.1.0+dev.ac24e9a");
  });

  it("records the protocol and schema versions from the bundled schema", () => {
    const document = buildMetadataDocument({}, [], []);
    expect(document.protocol_version).toBe(getProtocolVersion());
    expect(document.schema_version).toBe(getSchemaVersion());
  });
});
