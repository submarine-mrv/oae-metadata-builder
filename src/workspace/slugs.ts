import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { type SlugConflict, workspaceSlugConflicts } from "./slugConflicts";
import type { ProjectRecord, Workspace } from "./types";

/**
 * URL slugs for shareable links. A project or experiment slug is its human-readable ID whenever
 * unique in the workspace, else its internal ID. The backend reserves human IDs globally.
 * Unsynced local duplicates and legacy conflicts never require a multiple-matches chooser.
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

/**
 * Conflicting local drafts retain deterministic internal-ID URLs.
 */
function slugFor<T extends Identified>(item: T, siblings: T[], human: (item: T) => string): string {
  const id = human(item);
  if (!id) return item.id;
  return siblings.some((other) => other.id !== item.id && (other.id === id || human(other) === id))
    ? item.id
    : id;
}

/** Internal ID first, since it is unique; then the human ID, which may match several. */
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

export function projectSlug(
  project: ProjectRecord,
  projects: ProjectRecord[],
  conflicts: SlugConflict[] = [],
): string {
  if (
    [...(workspaceSlugConflicts(projects)[project.id] ?? []), ...conflicts].some(
      (c) =>
        c.entityType === "project" &&
        c.entityId === project.id &&
        c.slug === humanProjectId(project),
    )
  ) {
    return project.id;
  }
  return slugFor(project, projects, humanProjectId);
}

export function experimentSlug(
  experiment: ExperimentRecord,
  experiments: ExperimentRecord[],
  projects?: ProjectRecord[],
  conflicts: SlugConflict[] = [],
): string {
  if (
    [...Object.values(workspaceSlugConflicts(projects ?? [])).flat(), ...conflicts].some(
      (c) =>
        c.entityType === "experiment" &&
        c.entityId === experiment.id &&
        c.slug === humanExperimentId(experiment),
    )
  )
    return experiment.id;
  return slugFor(experiment, experiments, humanExperimentId);
}

/** Datasets have no human ID of their own, so their slug is always the internal ID. */
export function datasetSlug(dataset: DatasetRecord): string {
  return dataset.id;
}

export function resolveProject(
  slug: string,
  projects: ProjectRecord[],
  conflicts: SlugConflict[] = [],
): Resolution<ProjectRecord> {
  return resolve(slug, projects, (project) =>
    projectSlug(project, projects, conflicts) === project.id ? "" : humanProjectId(project),
  );
}

export function resolveExperiment(
  slug: string,
  experiments: ExperimentRecord[],
  projects?: ProjectRecord[],
  conflicts: SlugConflict[] = [],
): Resolution<ExperimentRecord> {
  return resolve(slug, experiments, (experiment) =>
    experimentSlug(experiment, experiments, projects, conflicts) === experiment.id
      ? ""
      : humanExperimentId(experiment),
  );
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
 * Copied URLs and navigation both use internal IDs for conflicting local drafts.
 */
export function entityLocation(
  workspace: Workspace,
  projectId: string,
  page: EntityPage,
  entityId?: string | null,
  { conflicts = {} }: { conflicts?: Record<string, SlugConflict[]> } = {},
): EntityLocation | null {
  const project = workspace.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const projectConflicts = conflicts[project.id] ?? [];
  const params = { projectId: projectSlug(project, workspace.projects, projectConflicts) };
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
          experimentId: experimentSlug(
            experiment,
            experiments,
            workspace.projects,
            projectConflicts,
          ),
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
