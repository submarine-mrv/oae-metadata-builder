import { describe, expect, it } from "vitest";
import {
  DATA_FILE_TEMPLATES,
  detectTemplate,
  getTemplate,
  matchTemplate,
} from "../dataFileTemplates";

const bottle = getTemplate("bottle");
const autonomous = getTemplate("autonomous");
const physiological = getTemplate("physiological");

describe("DATA_FILE_TEMPLATES", () => {
  it("covers the four protocol data types", () => {
    expect(DATA_FILE_TEMPLATES.map((t) => t.id)).toEqual([
      "bottle",
      "flow_through",
      "autonomous",
      "physiological",
    ]);
  });

  it("has no duplicate columns within a template", () => {
    for (const t of DATA_FILE_TEMPLATES) {
      expect(new Set(t.columns).size, t.id).toBe(t.columns.length);
    }
  });

  it("preserves upstream spelling, including the typos", () => {
    // Real files carry these, so correcting them here would stop them matching.
    expect(autonomous?.columns).toContain("Pressue_ATM_LICOR");
    expect(physiological?.columns).toContain("Aragonite_sauration_state");
    expect(physiological?.columns).toContain("Number _of_individuals");
  });
});

describe("matchTemplate", () => {
  it("splits columns into matched, extra, and absent", () => {
    const match = matchTemplate(["Exp_ID", "Latitude", "not_a_template_column"], bottle!);

    expect(match.matched).toEqual(["Exp_ID", "Latitude"]);
    expect(match.extra).toEqual(["not_a_template_column"]);
    expect(match.absent).toContain("Cruise_ID");
  });

  it("matches case-insensitively", () => {
    const match = matchTemplate(["exp_id", "LATITUDE"], bottle!);

    expect(match.extra).toEqual([]);
  });
});

describe("detectTemplate", () => {
  it.each(
    DATA_FILE_TEMPLATES.map((t) => [t.id, t] as const),
  )("identifies %s from its own columns", (_id, template) => {
    expect(detectTemplate(template.columns)?.template.id).toBe(template.id);
  });

  it("returns nothing when most columns belong to no template", () => {
    expect(detectTemplate(["alpha", "beta", "gamma", "delta", "Exp_ID"])).toBeUndefined();
  });

  it("returns nothing for an empty file", () => {
    expect(detectTemplate([])).toBeUndefined();
  });

  it("requires a column unique to the template, not just shared ones", () => {
    // Exp_ID is in all four and the coordinates are in three, so these identify
    // nothing. Previously they matched whichever template came first.
    expect(detectTemplate(["Exp_ID", "Latitude", "Longitude"])).toBeUndefined();
    expect(detectTemplate(["Exp_ID"])).toBeUndefined();
  });

  it("still identifies a partial file that carries a distinctive column", () => {
    // Rosette_position and Niskin_ID appear only in bottle.
    expect(detectTemplate(["Exp_ID", "Rosette_position", "Niskin_ID"])?.template.id).toBe("bottle");
  });
});
