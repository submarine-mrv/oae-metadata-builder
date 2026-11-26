import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import type { ProjectRecord, Workspace } from "./types";

export type Resolution<T> = { kind: "found"; value: T } | { kind: "not-found" };

/** Builder URLs use stable internal IDs, never editable metadata IDs. */
function resolve<T extends { id: string }>(slug: string, items: T[]): Resolution<T> {
  const byId = items.find((item) => item.id === slug);
  return byId ? { kind: "found", value: byId } : { kind: "not-found" };
}

export function resolveProject(slug: string, projects: ProjectRecord[]): Resolution<ProjectRecord> {
  return resolve(slug, projects);
}

export function resolveExperiment(
  slug: string,
  experiments: ExperimentRecord[],
): Resolution<ExperimentRecord> {
  return resolve(slug, experiments);
}

export function resolveDataset(slug: string, datasets: DatasetRecord[]): Resolution<DatasetRecord> {
  return resolve(slug, datasets);
}

export type EntityPage = "overview" | "metadata" | "experiment" | "dataset";

export type EntityLocation =
  | { to: "/projects/$projectId"; params: { projectId: string } }
  | { to: "/projects/$projectId/metadata"; params: { projectId: string } }
  | {
      to: "/projects/$projectId/experiments/$experimentId";
      params: { projectId: string; experimentId: string };
    }
  | {
      to: "/projects/$projectId/datasets/$datasetId";
      params: { projectId: string; datasetId: string };
    };

/**
 * Where a page of a project lives, or null when the project or entity doesn't exist.
 * Copied links and in-app navigation use the same URL.
 */
export function entityLocation(
  workspace: Workspace,
  projectId: string,
  page: EntityPage,
  entityId?: string | null,
): EntityLocation | null {
  const project = workspace.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const params = { projectId: project.id };
  switch (page) {
    case "overview":
      return { to: "/projects/$projectId", params };
    case "metadata":
      return { to: "/projects/$projectId/metadata", params };
    case "experiment": {
      const { experiments } = project.state;
      const experiment = experiments.find((e) => e.id === entityId);
      if (!experiment) return null;
      return {
        to: "/projects/$projectId/experiments/$experimentId",
        params: {
          ...params,
          experimentId: experiment.id,
        },
      };
    }
    case "dataset": {
      const dataset = project.state.datasets.find((d) => d.id === entityId);
      if (!dataset) return null;
      return {
        to: "/projects/$projectId/datasets/$datasetId",
        params: { ...params, datasetId: dataset.id },
      };
    }
  }
}
