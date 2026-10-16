import { describe, expect, it } from "vitest";
import { mergeWorkspace } from "../merge";
import { emptyProjectState, newProjectRecord, type Workspace } from "../types";

function workspace(projectId: string, projectName: string, now: number): Workspace {
  const project = newProjectRecord(
    {
      ...emptyProjectState(),
      projectData: { project_id: projectId, research_project: projectName },
    },
    now,
  );
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

describe("mergeWorkspace", () => {
  it("merges same-project fields and replaces matching experiments like project import", () => {
    const target = workspace("P1", "Local title", 10);
    target.projects[0].state.experiments.push({
      id: 1,
      name: "E1",
      formData: { project_id: "P1", experiment_id: "E1", description: "Local" },
      createdAt: 10,
      updatedAt: 10,
    });
    const incoming = workspace("P1", "Cloud title", 20);
    incoming.projects[0].state.experiments.push({
      id: 1,
      name: "E1",
      formData: { project_id: "P1", experiment_id: "E1", description: "Cloud" },
      createdAt: 20,
      updatedAt: 20,
    });

    const merged = mergeWorkspace(target, incoming);

    expect(merged.projects).toHaveLength(1);
    expect(merged.projects[0].id).toBe(target.projects[0].id);
    expect(merged.projects[0].state.projectData.research_project).toBe("Cloud title");
    expect(merged.projects[0].state.experiments).toHaveLength(1);
    expect(merged.projects[0].state.experiments[0].formData.description).toBe("Cloud");
  });

  it("adds projects only present in the incoming workspace and preserves the active project", () => {
    const target = workspace("P1", "Local", 10);
    const incoming = workspace("P2", "Cloud", 20);

    const merged = mergeWorkspace(target, incoming);

    expect(merged.projects.map((project) => project.state.projectData.project_id)).toEqual([
      "P1",
      "P2",
    ]);
    expect(merged.activeProjectId).toBe(target.activeProjectId);
  });

  it("adds new datasets but does not duplicate an identical dataset on repeated sync", () => {
    const target = workspace("P1", "Local", 10);
    const project = target.projects[0];
    project.state.experiments.push({
      id: 1,
      name: "E1",
      formData: { project_id: "P1", experiment_id: "E1" },
      createdAt: 10,
      updatedAt: 10,
    });
    project.state.datasets.push({
      id: 1,
      name: "Existing",
      formData: { project_id: "P1", experiment_id: "E1", name: "Existing" },
      linking: { linkedExperimentInternalId: 1 },
      createdAt: 10,
      updatedAt: 10,
    });

    const incoming = workspace("P1", "Local", 10);
    incoming.projects[0].state.experiments.push({ ...project.state.experiments[0] });
    incoming.projects[0].state.datasets.push({ ...project.state.datasets[0] });
    incoming.projects[0].state.datasets.push({
      id: 2,
      name: "Incoming",
      formData: { project_id: "P1", experiment_id: "E1", name: "Incoming" },
      linking: { linkedExperimentInternalId: 1 },
      createdAt: 20,
      updatedAt: 20,
    });

    const merged = mergeWorkspace(target, incoming);
    const retried = mergeWorkspace(merged, incoming);

    expect(merged.projects[0].state.datasets.map((dataset) => dataset.name)).toEqual([
      "Existing",
      "Incoming",
    ]);
    expect(retried).toBe(merged);
    expect(retried.projects[0].state.datasets).toHaveLength(2);
  });

  it("preserves projects that use the same workspace record ID but different project IDs", () => {
    const target = workspace("P1", "Local", 10);
    const incoming = workspace("P2", "Cloud", 20);
    incoming.projects[0].id = target.projects[0].id;

    const merged = mergeWorkspace(target, incoming);

    expect(merged.projects).toHaveLength(2);
    expect(new Set(merged.projects.map((project) => project.id)).size).toBe(2);
  });

  it("is a no-op when the incoming workspace is identical", () => {
    const target = workspace("P1", "Local", 10);
    expect(mergeWorkspace(target, structuredClone(target))).toBe(target);
  });
});
