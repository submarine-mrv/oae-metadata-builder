import type { JSONSchema } from "@/components/schemaUtils";
import type { ExperimentRecord } from "@/types/forms";
import type { ProjectState } from "@/workspace/types";
import { migrateDataset, migrateExperiment, migrateProject } from "./migrations";
import { parseDataset, parseExperiment, parseProject } from "./parseEntity";
import { getBaseSchema } from "./schemaViews";
import { isUuid, stableUuid } from "./stableUuid";
import { withVariableUuids } from "./variableUuid";

/**
 * Drafts from before UUIDs number entities; every tab maps them to the same strings. With a
 * project ID, as in the cloud, where entity IDs are UUIDs unique across projects, any other ID
 * maps to the same UUID in every tab instead.
 */
const legacyId = (kind: "experiment" | "dataset", id: unknown, projectId?: string) => {
  const value = typeof id === "number" ? `${kind}-${id}` : (id as string);
  return projectId === undefined || isUuid(value)
    ? value
    : stableUuid(`${projectId}:${kind}:${value}`);
};

/**
 * Parse a persisted project at the boundary. A project may have been saved
 * before the current invariants existed or under an older app version, so
 * parseExperiment/parseDataset re-establish model exclusivity, type-scoped
 * fields and clean variables, and migrate handles the legacy bounding box.
 *
 * Pass `projectId` for drafts headed to the cloud: entity IDs become UUIDs, every
 * variable gets one, both stable across tabs, and every dataset states its link.
 */
export function parseProjectState(saved: ProjectState, projectId?: string): ProjectState {
  const experimentIds = new Set(
    saved.experiments.map((exp) => legacyId("experiment", exp.id, projectId)),
  );
  const experiments = saved.experiments.map((exp) => {
    // Older saves carry a top-level copy of formData.experiment_types.
    const { experiment_types: _, ...record } = exp as ExperimentRecord & {
      experiment_types?: unknown;
    };
    return {
      ...record,
      id: legacyId("experiment", exp.id, projectId),
      formData: parseExperiment(migrateExperiment(exp.formData)),
    };
  });
  const datasets = saved.datasets.map((ds) => {
    const linked = ds.linking?.linkedExperimentInternalId;
    const linkedId = linked == null ? null : legacyId("experiment", linked, projectId);
    const id = legacyId("dataset", ds.id, projectId);
    const formData = parseDataset(
      migrateDataset(ds.formData),
      getBaseSchema() as unknown as JSONSchema,
    );
    return {
      ...ds,
      id,
      formData:
        projectId === undefined
          ? formData
          : withVariableUuids(formData, (index) =>
              stableUuid(`${projectId}:dataset:${id}:variable:${index}`),
            ),
      // The cloud stores "no link" as null, so a cloud draft always states it.
      ...(ds.linking || projectId !== undefined
        ? {
            linking: {
              ...ds.linking,
              linkedExperimentInternalId: linkedId && experimentIds.has(linkedId) ? linkedId : null,
            },
          }
        : {}),
    };
  });
  // Counters from before UUIDs are dropped.
  return {
    projectData: parseProject(migrateProject(saved.projectData)),
    experiments,
    datasets,
  };
}
