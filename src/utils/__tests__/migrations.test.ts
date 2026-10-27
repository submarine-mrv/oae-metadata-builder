import { describe, expect, it } from "vitest";
import {
  migrateDataset,
  migrateExperiment,
  migratePHCalibrationStandard,
  migrateProject,
  migratePublicComments,
  migrateResearchProject,
} from "../migrations";

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

describe("migrateExperiment", () => {
  it("runs the public comments migration at load boundaries", () => {
    const result = migrateExperiment({ public_comments: "a.pdf, b.pdf" });
    expect(result.public_comments).toHaveLength(1);
  });

  it("runs box-string and public-comment migrations together", () => {
    const result = migrateExperiment({
      public_comments: "a.pdf",
      spatial_coverage: { geo: { box: "-124.5 47.2 -122.3 48.2" } },
    });

    expect(result.public_comments).toEqual([{ description: "a.pdf", comment_type: "other" }]);
    expect(result.spatial_coverage.geo.box).toBe("47.2 -124.5 48.2 -122.3");
  });
});

describe("migrateProject", () => {
  it("passes through non-objects", () => {
    expect(migrateProject(null as never)).toBeNull();
  });

  it("returns the same reference for current-format data", () => {
    const data = { name: "A", spatial_coverage: { geo: { box: "32 -125 42 -114" } } };
    expect(migrateProject(data)).toBe(data);
  });

  it("does not run experiment migrations", () => {
    const data = { name: "A", public_comments: "a.pdf" };
    expect(migrateProject(data)).toBe(data);
  });
});

describe("migrateResearchProject", () => {
  it("renames research_project to name", () => {
    expect(migrateResearchProject({ project_id: "P1", research_project: "Kiel trial" })).toEqual({
      project_id: "P1",
      name: "Kiel trial",
    });
  });

  it("keeps an existing name and drops research_project", () => {
    expect(migrateResearchProject({ name: "New", research_project: "Old" })).toEqual({
      name: "New",
    });
  });

  it("fills an empty name from research_project", () => {
    expect(migrateResearchProject({ name: " ", research_project: "Old" })).toEqual({ name: "Old" });
  });

  it("returns the same object when there is nothing to migrate", () => {
    const data = { name: "Kiel trial" };
    expect(migrateResearchProject(data)).toBe(data);
  });
});

describe("migratePHCalibrationStandard", () => {
  const withCalibration = (calibration: Record<string, unknown>) => ({
    variables: [{ schema_class: "DiscretePHVariable", analyzing_instrument: { calibration } }],
  });
  const calibrationOf = (data: Record<string, any>) =>
    data.variables[0].analyzing_instrument.calibration;

  it("renames the dye type field and marks the standard as dye", () => {
    const result = migratePHCalibrationStandard(
      withCalibration({ dye_type_and_manufacturer: "mCP" }),
    );
    expect(calibrationOf(result)).toEqual({
      standard_type_and_production: "mCP",
      standard_used: "dye",
    });
  });

  it("marks the standard as dye when only a dye field is set", () => {
    const result = migratePHCalibrationStandard(withCalibration({ dye_purified: false }));
    expect(calibrationOf(result)).toEqual({ dye_purified: false, standard_used: "dye" });
  });

  it("keeps a standard the user already chose", () => {
    const result = migratePHCalibrationStandard(
      withCalibration({ standard_used: "tris", dye_type_and_manufacturer: "x" }),
    );
    expect(calibrationOf(result)).toEqual({
      standard_used: "tris",
      standard_type_and_production: "x",
    });
  });

  it("leaves calibrations without dye data alone", () => {
    const data = withCalibration({ ph_of_standards: "7.0" });
    expect(migratePHCalibrationStandard(data)).toBe(data);
  });

  it("runs as part of migrateDataset", () => {
    const result = migrateDataset(withCalibration({ dye_correction_method: "Liu 2011" }));
    expect(calibrationOf(result).standard_used).toBe("dye");
  });
});
