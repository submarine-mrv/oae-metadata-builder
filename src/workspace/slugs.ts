import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import type { ProjectRecord, Workspace } from "./types";

/**
 * URL slugs for shareable links (submarine-mrv/oae-data-commons#192). A project or experiment
 * slug is its human-readable ID whenever set, even if another draft shares it (only publication
 * enforces uniqueness), else its internal ID. Resolution reports several matches rather than guess;
 * in-app navigation targets the internal ID instead, so it always opens the exact record.
 */

export type Resolution<T> =
  | { kind: "found"; value: T }
  | { kind: "ambiguous"; matches: T[] }
  | { kind: "not-found" };

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
 * The address-bar and copied slug: the human ID, even when a sibling shares it, unless it is empty
 * or equal to a sibling's internal ID (which resolution would match first, opening the sibling).
 */
function slugFor<T extends Identified>(item: T, siblings: T[], human: (item: T) => string): string {
  const id = human(item);
  if (!id) return item.id;
  return siblings.some((other) => other.id !== item.id && other.id === id) ? item.id : id;
}

/**
 * Where in-app navigation goes: the internal ID when a sibling shares the human ID, so the route
 * opens this record and then shows `slugFor` in the address bar; otherwise `slugFor`.
 */
function targetFor<T extends Identified>(
  item: T,
  siblings: T[],
  human: (item: T) => string,
): string {
  const slug = slugFor(item, siblings, human);
  const shared = siblings.some((other) => other.id !== item.id && human(other) === slug);
  return slug !== item.id && shared ? item.id : slug;
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
  if (matches.length > 1) return { kind: "ambiguous", matches };
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

/** Datasets have no human ID of their own, so their slug is always the internal ID. */
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
 * Where a page of a project lives, or null when the project or entity doesn't exist. `share`
 * gives the copyable URL, with human IDs even when shared; the default targets the exact record.
 */
export function entityLocation(
  workspace: Workspace,
  projectId: string,
  page: EntityPage,
  entityId?: string | null,
  { share = false }: { share?: boolean } = {},
): EntityLocation | null {
  const slug = share ? slugFor : targetFor;
  const project = workspace.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const params = { projectId: slug(project, workspace.projects, humanProjectId) };
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
        params: { ...params, experimentId: slug(experiment, experiments, humanExperimentId) },
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
