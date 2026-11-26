import { describe, expect, it } from "vitest";
import type { ExperimentRecord } from "@/types/forms";
import { entityLocation, resolveDataset, resolveExperiment, resolveProject } from "../slugs";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";

const experiment: ExperimentRecord = {
  id: "internal-experiment",
  name: "Experiment",
  formData: { experiment_id: "HUMAN-EXP" },
  createdAt: 1,
  updatedAt: 1,
};
const project = {
  ...newProjectRecord({
    ...emptyProjectState(),
    projectData: { project_id: "HUMAN-PROJECT" },
    experiments: [experiment],
    datasets: [{ ...experiment, id: "internal-dataset", formData: {} }],
  }),
  id: "internal-project",
};
const workspace: Workspace = { version: 1, activeProjectId: project.id, projects: [project] };

describe("internal-ID slugs", () => {
  it("resolves only internal IDs, never human IDs or case variants", () => {
    expect(resolveProject(project.id, [project])).toEqual({ kind: "found", value: project });
    expect(resolveProject("HUMAN-PROJECT", [project])).toEqual({ kind: "not-found" });
    expect(resolveProject("INTERNAL-PROJECT", [project])).toEqual({ kind: "not-found" });
    expect(resolveExperiment("HUMAN-EXP", [experiment])).toEqual({ kind: "not-found" });
    expect(resolveExperiment(experiment.id, [experiment])).toEqual({
      kind: "found",
      value: experiment,
    });
    expect(resolveDataset("internal-dataset", project.state.datasets).kind).toBe("found");
  });

  it("keeps all links stable across human-ID renames and duplicates", () => {
    const before = entityLocation(workspace, project.id, "experiment", experiment.id);
    const renamed: Workspace = {
      ...workspace,
      projects: [
        {
          ...project,
          state: {
            ...project.state,
            projectData: { project_id: "CHANGED" },
            experiments: [
              { ...experiment, formData: { experiment_id: "DUP" } },
              { ...experiment, id: "other", formData: { experiment_id: "DUP" } },
            ],
          },
        },
      ],
    };
    expect(before).toEqual({
      to: "/projects/$projectId/experiments/$experimentId",
      params: { projectId: project.id, experimentId: experiment.id },
    });
    expect(entityLocation(renamed, project.id, "experiment", experiment.id)).toEqual(before);
    expect(entityLocation(workspace, project.id, "overview")?.params).toEqual({
      projectId: project.id,
    });
    expect(entityLocation(workspace, project.id, "dataset", "internal-dataset")?.params).toEqual({
      projectId: project.id,
      datasetId: "internal-dataset",
    });
    expect(entityLocation(workspace, "missing", "overview")).toBeNull();
    expect(entityLocation(workspace, project.id, "experiment", "missing")).toBeNull();
  });

  it("retains legacy internal entity IDs without regenerating them", () => {
    const legacy = { ...experiment, id: "experiment-1" };
    expect(resolveExperiment("experiment-1", [legacy])).toEqual({ kind: "found", value: legacy });
  });
});
