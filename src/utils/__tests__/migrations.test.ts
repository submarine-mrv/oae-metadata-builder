import { describe, expect, it } from "vitest";
import { migrateFormData, migratePublicComments } from "../migrations";

describe("migratePublicComments", () => {
  it("keeps the old text whole as one entry's description", () => {
    const result = migratePublicComments({
      public_comments: "permit-comments.pdf, media-coverage.pdf",
    });

    // Filenames are not links, and a comma is not proof of separate documents,
    // so nothing is split or guessed into a URL.
    expect(result.public_comments).toEqual([
      { description: "permit-comments.pdf, media-coverage.pdf", comment_type: "other" },
    ]);
  });

  it("leaves url unset so the required field flags the entry", () => {
    const [entry] = migratePublicComments({ public_comments: "all-comments.pdf" }).public_comments;
    expect(entry.url).toBeUndefined();
    expect(entry.comment_type).toBe("other");
  });

  it("trims surrounding whitespace", () => {
    const [entry] = migratePublicComments({ public_comments: "  a.pdf  " }).public_comments;
    expect(entry.description).toBe("a.pdf");
  });

  it("drops the field when the string was blank", () => {
    const result = migratePublicComments({ name: "Exp", public_comments: "   " });
    expect("public_comments" in result).toBe(false);
    expect(result.name).toBe("Exp");
  });

  // The interim list shape from earlier in the 0.4.0 cycle carried `filename`.
  it("moves an interim filename entry into the description", () => {
    const result = migratePublicComments({
      public_comments: [{ filename: "a.pdf", comment_type: "permitting" }],
    });
    expect(result.public_comments).toEqual([{ description: "a.pdf", comment_type: "permitting" }]);
    expect("filename" in result.public_comments[0]).toBe(false);
  });

  it("keeps an existing description over the filename", () => {
    const [entry] = migratePublicComments({
      public_comments: [{ filename: "a.pdf", description: "Kept", comment_type: "other" }],
    }).public_comments;
    expect(entry.description).toBe("Kept");
    expect("filename" in entry).toBe(false);
  });

  it("only rewrites the entries that need it", () => {
    const good = { url: "https://example.org/b.pdf", comment_type: "other" };
    const result = migratePublicComments({
      public_comments: [{ filename: "a.pdf", comment_type: "other" }, good],
    });
    expect(result.public_comments[1]).toBe(good);
  });

  it("leaves already-migrated data untouched", () => {
    const data = {
      public_comments: [{ url: "https://example.org/a.pdf", comment_type: "permitting" }],
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
    expect(result.public_comments).toHaveLength(1);
  });

  it("runs box-string and public-comment migrations together", () => {
    const result = migrateFormData({
      public_comments: "a.pdf",
      spatial_coverage: { geo: { box: "-124.5 47.2 -122.3 48.2" } },
    });

    expect(result.public_comments).toEqual([{ description: "a.pdf", comment_type: "other" }]);
    expect(result.spatial_coverage.geo.box).toBe("47.2 -124.5 48.2 -122.3");
  });

  it("passes through non-objects", () => {
    expect(migrateFormData(null as never)).toBeNull();
  });
});
