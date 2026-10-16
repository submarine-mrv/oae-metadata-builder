import type { DatasetRecord } from "@/types/forms";
import { applyImport, type ImportSelection } from "@/utils/applyImport";
import type { ProjectRecord, ProjectState, Workspace } from "./types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function equalData(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function projectKey(project: ProjectRecord): string {
  const projectId = project.state.projectData.project_id;
  return typeof projectId === "string" && projectId.trim()
    ? `project:${projectId}`
    : `record:${project.id}`;
}

function matchesExperiment(target: ProjectState, experimentId: unknown, recordId: number) {
  return target.experiments.find((experiment) =>
    typeof experimentId === "string" && experimentId
      ? experiment.formData.experiment_id === experimentId || experiment.name === experimentId
      : experiment.id === recordId,
  );
}

function importSelection(target: ProjectState, incoming: ProjectState): ImportSelection {
  const experiments = incoming.experiments.filter((incomingExperiment) => {
    const incomingId = incomingExperiment.formData.experiment_id;
    const existing = matchesExperiment(target, incomingId, incomingExperiment.id);
    return !existing || !equalData(existing.formData, incomingExperiment.formData);
  });
  const importKeys = new Map(
    experiments.map((experiment, index) => [experiment.id, `experiment-${index}`]),
  );

  const datasets = incoming.datasets
    .filter(
      (dataset) =>
        !target.datasets.some((existing) => equalData(existing.formData, dataset.formData)),
    )
    .map((dataset: DatasetRecord) => {
      const linkedExperimentId = dataset.linking?.linkedExperimentInternalId;
      const linkedExperiment =
        typeof linkedExperimentId !== "number"
          ? undefined
          : incoming.experiments.find((experiment) => experiment.id === linkedExperimentId);
      const linkedKey =
        typeof linkedExperimentId === "number" ? importKeys.get(linkedExperimentId) : undefined;
      const targetExperiment = linkedExperiment
        ? matchesExperiment(target, linkedExperiment.formData.experiment_id, linkedExperiment.id)
        : undefined;
      return {
        formData: dataset.formData,
        experimentLinking: linkedKey
          ? { mode: "explicit" as const, explicitImportKey: linkedKey }
          : targetExperiment
            ? {
                mode: "explicit" as const,
                explicitExperimentInternalId: targetExperiment.id,
              }
            : undefined,
      };
    });

  return {
    project: incoming.projectData,
    experiments: experiments.map((experiment) => experiment.formData),
    datasets,
  };
}

function mergeProjectState(target: ProjectState, incoming: ProjectState): ProjectState {
  const merged = applyImport(target, importSelection(target, incoming));
  return equalData(merged, target) ? target : merged;
}

function mergeProjectRecord(target: ProjectRecord, incoming: ProjectRecord): ProjectRecord {
  const state = mergeProjectState(target.state, incoming.state);
  if (state === target.state) return target;
  return {
    ...target,
    state,
    createdAt: Math.min(target.createdAt, incoming.createdAt),
    updatedAt: Math.max(Date.now(), target.updatedAt + 1, incoming.updatedAt),
  };
}

/**
 * Reconciles a remote workspace into the current workspace using the same
 * project/experiment import merge rules as `applyImport`. Exact duplicate
 * datasets are omitted so retrying an identical cloud snapshot is idempotent.
 */
export function mergeWorkspace(target: Workspace, incoming: Workspace): Workspace {
  let changed = false;
  const projects = [...target.projects];

  for (const remoteProject of incoming.projects) {
    const key = projectKey(remoteProject);
    const existingIndex = projects.findIndex((project) => projectKey(project) === key);

    if (existingIndex >= 0) {
      const merged = mergeProjectRecord(projects[existingIndex], remoteProject);
      if (merged !== projects[existingIndex]) {
        projects[existingIndex] = merged;
        changed = true;
      }
      continue;
    }

    const idInUse = projects.some((project) => project.id === remoteProject.id);
    projects.push(idInUse ? { ...remoteProject, id: crypto.randomUUID() } : remoteProject);
    changed = true;
  }

  const activeProjectId = target.projects.some((project) => project.id === target.activeProjectId)
    ? target.activeProjectId
    : (incoming.projects.find((project) => project.id === incoming.activeProjectId)?.id ??
      projects[0]?.id ??
      null);

  if (!changed && activeProjectId === target.activeProjectId) return target;
  return { ...target, activeProjectId, projects };
}
