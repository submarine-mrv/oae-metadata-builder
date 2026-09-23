import { describe, expect, it } from "vitest";
import type { DraftProject } from "@/types/forms";
import { formStatus } from "../formStatus";
import { validateDataset, validateExperiment, validateProject } from "../validation";

// Relational, not exact: the percentages follow the schema's required fields.
const project = (data: DraftProject) => formStatus(data, validateProject);
const empty = { percentage: 0, isValid: false, isEmpty: true };

describe("formStatus", () => {
  it("is empty and not valid for missing or empty data", () => {
    expect(formStatus(undefined, validateExperiment)).toEqual(empty);
    expect(formStatus({}, validateExperiment)).toEqual(empty);
    expect(formStatus(undefined, validateDataset)).toEqual(empty);
  });

  it("a fresh project is 0% and not valid", () => {
    expect(project({ project_id: "" })).toMatchObject({ percentage: 0, isValid: false });
  });

  it("a partly filled project rises with each required field and is not valid", () => {
    const small = project({ project_id: "P" });
    const larger = project({
      project_id: "P",
      description: "D",
      mcdr_pathway: "ocean_alkalinity_enhancement",
    });
    expect(small.percentage).toBeGreaterThan(0);
    expect(larger.percentage).toBeGreaterThan(small.percentage);
    expect(larger).toMatchObject({ isValid: false, isEmpty: false });
    expect(larger.percentage).toBeLessThan(100);
  });

  it("does not count blank strings or empty arrays, and counts filled objects", () => {
    const pathway = { mcdr_pathway: "ocean_alkalinity_enhancement" } as const;
    expect(
      project({ project_id: "test", description: "Real", ...pathway }).percentage,
    ).toBeGreaterThan(project({ project_id: "", description: "   ", ...pathway }).percentage);
    expect(
      project({ project_id: "t", project_leads: [{ name: "Alice", email: "alice@example.com" }] })
        .percentage,
    ).toBeGreaterThan(project({ project_id: "t", project_leads: [] }).percentage);
    expect(
      project({ project_id: "t", spatial_coverage: { geo: { box: "0 0 1 1" } } }).percentage,
    ).toBeGreaterThan(project({ project_id: "t" }).percentage);
  });

  it("scores an intervention experiment against its extra required fields", () => {
    const base = { experiment_id: "exp-001", description: "Test" };
    const baseline = formStatus({ ...base, experiment_types: ["baseline"] }, validateExperiment);
    const intervention = formStatus(
      { ...base, experiment_types: ["intervention"] },
      validateExperiment,
    );
    expect(baseline.percentage).toBeGreaterThan(0);
    expect(baseline.percentage).toBeLessThan(100);
    expect(intervention.percentage).toBeGreaterThan(0);
    expect(intervention.percentage).toBeLessThan(50);
  });

  it("a partly filled dataset is not empty and not valid", () => {
    const status = formStatus({ dataset_type: "field", name: "sample" }, validateDataset);
    expect(status).toMatchObject({ isEmpty: false, isValid: false });
    expect(status.percentage).toBeLessThan(100);
  });
});
