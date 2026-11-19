import type { ProjectRecord } from "./types";

export type SlugConflict = {
  entityType: "project" | "experiment";
  entityId: string;
  slug: string;
};

export const SLUG_CONFLICT_MESSAGE =
  "This ID is already in use. Choose a unique ID or leave it empty. Changes to this project will not sync to the cloud until this is fixed.";

export class SlugConflictError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly conflicts: SlugConflict[],
  ) {
    super(SLUG_CONFLICT_MESSAGE);
    this.name = "SlugConflictError";
  }
}

export function parseSlugConflicts(value: unknown): SlugConflict[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (item: unknown) =>
        typeof item !== "object" ||
        item === null ||
        !("entityType" in item) ||
        (item.entityType !== "project" && item.entityType !== "experiment") ||
        !("entityId" in item) ||
        typeof item.entityId !== "string" ||
        !("slug" in item) ||
        typeof item.slug !== "string" ||
        !item.slug,
    )
  ) {
    throw new Error("Supabase returned invalid ID conflict details.");
  }
  return value;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function matchingSlugConflicts(
  project: ProjectRecord,
  conflicts: SlugConflict[],
): SlugConflict[] {
  return conflicts.filter((conflict) =>
    conflict.entityType === "project"
      ? conflict.entityId === project.id &&
        conflict.slug === trimmed(project.state.projectData.project_id)
      : project.state.experiments.some(
          (experiment) =>
            experiment.id === conflict.entityId &&
            conflict.slug === trimmed(experiment.formData.experiment_id),
        ),
  );
}

/** Match the registry's shared namespace, including internal-ID shadowing. */
export function workspaceSlugConflicts(projects: ProjectRecord[]): Record<string, SlugConflict[]> {
  const claims = projects.flatMap((project) => [
    {
      projectId: project.id,
      entityType: "project" as const,
      entityId: project.id,
      slug: trimmed(project.state.projectData.project_id),
    },
    ...project.state.experiments.map((experiment) => ({
      projectId: project.id,
      entityType: "experiment" as const,
      entityId: experiment.id,
      slug: trimmed(experiment.formData.experiment_id),
    })),
  ]);
  const result: Record<string, SlugConflict[]> = {};
  for (const claim of claims) {
    if (
      claim.slug &&
      claims.some(
        (other) =>
          (other.projectId !== claim.projectId ||
            other.entityType !== claim.entityType ||
            other.entityId !== claim.entityId) &&
          (other.slug === claim.slug || other.entityId === claim.slug),
      )
    ) {
      result[claim.projectId] ??= [];
      result[claim.projectId].push({
        entityType: claim.entityType,
        entityId: claim.entityId,
        slug: claim.slug,
      });
    }
  }
  return result;
}
