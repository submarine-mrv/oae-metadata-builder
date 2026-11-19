import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import type { ProjectRecord, Workspace } from "./types";

/**
 * URL slugs for shareable links. A project or experiment slug is its human-readable ID whenever
 * unique in the workspace, else its internal ID. The backend reserves human IDs globally, so a
 * duplicate is only ever local and unsynced; it uses the internal ID rather than a chooser.
 */

export type Resolution<T> = { kind: "found"; value: T } | { kind: "not-found" };

type Identified = { id: string };

/** Imported JSON isn't type-checked, so the field may not be a string. */
function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function humanProjectId(project: ProjectRecord): string {
  return trimmed(project.state.projectData.project_id);
}

export function humanExperimentId(experiment: ExperimentRecord): string {
  return trimmed(experiment.formData.experiment_id);
}

function slugFor<T extends Identified>(item: T, siblings: T[], human: (item: T) => string): string {
  const id = human(item);
  if (!id) return item.id;
  return siblings.some((other) => other.id !== item.id && (other.id === id || human(other) === id))
    ? item.id
    : id;
}

/** Internal ID first, since it is unique; then a human ID that only one item uses. */
function resolve<T extends Identified>(
  slug: string,
  items: T[],
  human?: (item: T) => string,
): Resolution<T> {
  const byId = items.find((item) => item.id === slug);
  if (byId) return { kind: "found", value: byId };
  const id = slug.trim();
  const matches = human && id ? items.filter((item) => human(item) === id) : [];
  if (matches.length === 1) return { kind: "found", value: matches[0] };
  return { kind: "not-found" };
}

export function projectSlug(project: ProjectRecord, projects: ProjectRecord[]): string {
  return slugFor(project, projects, humanProjectId);
}

export function experimentSlug(
  experiment: ExperimentRecord,
  experiments: ExperimentRecord[],
): string {
  return slugFor(experiment, experiments, humanExperimentId);
}

export function datasetSlug(dataset: DatasetRecord): string {
  return dataset.id;
}

export function resolveProject(slug: string, projects: ProjectRecord[]): Resolution<ProjectRecord> {
  return resolve(slug, projects, humanProjectId);
}

export function resolveExperiment(
  slug: string,
  experiments: ExperimentRecord[],
): Resolution<ExperimentRecord> {
  return resolve(slug, experiments, humanExperimentId);
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
  const params = { projectId: projectSlug(project, workspace.projects) };
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
          experimentId: experimentSlug(experiment, experiments),
        },
      };
    }
    case "dataset": {
      const dataset = project.state.datasets.find((d) => d.id === entityId);
      if (!dataset) return null;
      return {
        to: "/projects/$projectId/datasets/$datasetId",
        params: { ...params, datasetId: datasetSlug(dataset) },
      };
    }
  }
}
