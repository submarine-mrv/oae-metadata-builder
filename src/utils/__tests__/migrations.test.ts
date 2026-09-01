import { describe, expect, it } from "vitest";
import { migrateFormData, migratePublicComments } from "../migrations";

describe("migratePublicComments", () => {
  it("splits a comma-separated string into typed entries", () => {
    const result = migratePublicComments({
      public_comments: "permit-comments.pdf, media-coverage.pdf",
    });

    expect(result.public_comments).toEqual([
      { filename: "permit-comments.pdf", comment_type: "other" },
      { filename: "media-coverage.pdf", comment_type: "other" },
    ]);
  });

  it("handles a single filename with no comma", () => {
    const result = migratePublicComments({ public_comments: "all-comments.pdf" });
    expect(result.public_comments).toEqual([
      { filename: "all-comments.pdf", comment_type: "other" },
    ]);
  });

  it("trims whitespace and drops empty segments", () => {
    const result = migratePublicComments({
      public_comments: "  a.pdf ,, b.pdf ,  ",
    });
    expect(result.public_comments).toEqual([
      { filename: "a.pdf", comment_type: "other" },
      { filename: "b.pdf", comment_type: "other" },
    ]);
  });

  it("drops the field when the string held no filenames", () => {
    const result = migratePublicComments({ name: "Exp", public_comments: "   " });
    expect("public_comments" in result).toBe(false);
    expect(result.name).toBe("Exp");
  });

  it("leaves already-migrated data untouched", () => {
    const data = {
      public_comments: [{ filename: "a.pdf", comment_type: "permitting" }],
    };
    expect(migratePublicComments(data)).toBe(data);
  });

  it("leaves data without the field untouched", () => {
    const data = { name: "Experiment" };
    expect(migratePublicComments(data)).toBe(data);
  });

  it("does not mutate its input", () => {
    const data = { public_comments: "a.pdf" };
    migratePublicComments(data);
    expect(data.public_comments).toBe("a.pdf");
  });
});

describe("migrateFormData", () => {
  it("runs the public comments migration at load boundaries", () => {
    const result = migrateFormData({ public_comments: "a.pdf, b.pdf" });
    expect(result.public_comments).toHaveLength(2);
  });

  it("runs box-string and public-comment migrations together", () => {
    const result = migrateFormData({
      public_comments: "a.pdf",
      spatial_coverage: { geo: { box: "-124.5 47.2 -122.3 48.2" } },
    });

    expect(result.public_comments).toEqual([{ filename: "a.pdf", comment_type: "other" }]);
    expect(result.spatial_coverage.geo.box).toBe("47.2 -124.5 48.2 -122.3");
  });

  it("passes through non-objects", () => {
    expect(migrateFormData(null as never)).toBeNull();
  });
});
