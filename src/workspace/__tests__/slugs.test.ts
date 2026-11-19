import { describe, expect, it } from "vitest";
import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import {
  datasetSlug,
  entityLocation,
  experimentSlug,
  projectSlug,
  resolveDataset,
  resolveExperiment,
  resolveProject,
} from "../slugs";
import { emptyProjectState, newProjectRecord, type ProjectRecord, type Workspace } from "../types";

function project(id: string, projectId: unknown = "", extra: Partial<ProjectRecord["state"]> = {}) {
  return {
    ...newProjectRecord({
      ...emptyProjectState(),
      ...extra,
      projectData: { project_id: projectId as string },
    }),
    id,
  };
}

function experiment(id: string, experimentId = ""): ExperimentRecord {
  return {
    id,
    name: `Exp ${id}`,
    formData: { experiment_id: experimentId },
    createdAt: 1,
    updatedAt: 1,
  };
}

function dataset(id: string): DatasetRecord {
  return { id, name: `Data ${id}`, formData: {}, createdAt: 1, updatedAt: 1 };
}

describe("slugs", () => {
  it("uses the trimmed human ID, else the internal ID", () => {
    const named = project("uuid-1", "  KIEL-01 ");
    const blank = project("uuid-2", "   ");
    const notString = project("uuid-3", 42);
    const all = [named, blank, notString];
    expect(projectSlug(named, all)).toBe("KIEL-01");
    expect(projectSlug(blank, all)).toBe("uuid-2");
    expect(projectSlug(notString, all)).toBe("uuid-3");
  });

  it("uses internal IDs for duplicate human IDs and internal-ID shadowing", () => {
    const a = project("uuid-a", "DUP");
    const b = project("uuid-b", "DUP");
    const c = project("uuid-c", "uuid-a");
    const all = [a, b, c];
    expect(projectSlug(a, all)).toBe("uuid-a");
    expect(projectSlug(b, all)).toBe("uuid-b");
    expect(projectSlug(c, all)).toBe("uuid-c");
  });

  it("uses internal IDs for duplicate experiments and datasets", () => {
    const one = experiment("e1", "SITE-A");
    const two = experiment("e2", "SITE-A");
    expect(experimentSlug(one, [one])).toBe("SITE-A");
    expect(experimentSlug(one, [one, two])).toBe("e1");
    expect(datasetSlug(dataset("d1"))).toBe("d1");
  });

  it("uses deterministic internal IDs for duplicate draft links", () => {
    const a = project("uuid-a", "DUP", {
      experiments: [experiment("e1", "S"), experiment("e2", "S")],
    });
    const b = project("uuid-b", "DUP");
    const workspace: Workspace = { version: 1, activeProjectId: a.id, projects: [a, b] };
    expect(entityLocation(workspace, a.id, "experiment", "e2")?.params).toEqual({
      projectId: "uuid-a",
      experimentId: "e2",
    });
  });

  it("resolves the internal ID before a human ID, and a unique trimmed human ID", () => {
    const a = project("uuid-a", "KIEL");
    const b = project("uuid-b", "uuid-a");
    expect(resolveProject("uuid-a", [a, b])).toEqual({ kind: "found", value: a });
    expect(resolveProject("KIEL", [a, b])).toEqual({ kind: "found", value: a });
    expect(resolveProject("missing", [a, b])).toEqual({ kind: "not-found" });
    expect(resolveProject("", [project("uuid-c")])).toEqual({ kind: "not-found" });
  });

  it("does not resolve duplicated human IDs or ask users to choose a match", () => {
    const a = project("uuid-a", "DUP");
    const b = project("uuid-b", "DUP");
    expect(resolveProject("DUP", [a, b])).toEqual({ kind: "not-found" });
    const one = experiment("e1", "SITE");
    const two = experiment("e2", "SITE");
    expect(resolveExperiment("SITE", [one, two])).toEqual({
      kind: "not-found",
    });
    expect(resolveExperiment("e2", [one, two])).toEqual({ kind: "found", value: two });
  });

  it("shares one namespace across projects and experiments, including hidden server conflicts", () => {
    const e = experiment("e1", "TAKEN");
    const a = project("p1", "TAKEN", { experiments: [e] });
    const b = project("p2", "FREE", { experiments: [experiment("e2", "TAKEN")] });
    expect(projectSlug(a, [a, b])).toBe("p1");
    expect(experimentSlug(e, [e], [a, b])).toBe("e1");
    expect(resolveExperiment("TAKEN", [e], [a, b])).toEqual({ kind: "not-found" });
    const conflicts = [{ entityType: "project" as const, entityId: "p2", slug: "FREE" }];
    expect(projectSlug(b, [a, b], conflicts)).toBe("p2");
    expect(resolveProject("FREE", [a, b], conflicts)).toEqual({ kind: "not-found" });
  });

  it("resolves legacy numbered IDs within their project, and datasets by internal ID only", () => {
    const legacy = experiment("experiment-1");
    expect(resolveExperiment("experiment-1", [legacy])).toEqual({ kind: "found", value: legacy });
    const d = dataset("dataset-1");
    expect(resolveDataset("dataset-1", [d])).toEqual({ kind: "found", value: d });
    expect(resolveDataset("Data dataset-1", [d])).toEqual({ kind: "not-found" });
  });

  it("builds locations from slugs, or null for a missing project or entity", () => {
    const p = project("uuid-p", "KIEL", {
      experiments: [experiment("e1", "SITE-A")],
      datasets: [dataset("d1")],
    });
    const workspace: Workspace = { version: 1, activeProjectId: p.id, projects: [p] };
    expect(entityLocation(workspace, p.id, "overview")).toEqual({
      to: "/projects/$projectId",
      params: { projectId: "KIEL" },
    });
    expect(entityLocation(workspace, p.id, "metadata")?.to).toBe("/projects/$projectId/metadata");
    expect(entityLocation(workspace, p.id, "experiment", "e1")).toEqual({
      to: "/projects/$projectId/experiments/$experimentId",
      params: { projectId: "KIEL", experimentId: "SITE-A" },
    });
    expect(entityLocation(workspace, p.id, "dataset", "d1")?.params).toEqual({
      projectId: "KIEL",
      datasetId: "d1",
    });
    expect(entityLocation(workspace, p.id, "experiment", "gone")).toBeNull();
    expect(entityLocation(workspace, "gone", "overview")).toBeNull();
  });
});
