import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { applyImport, type ImportSelection } from "@/utils/applyImport";
import type { ProjectRecord, ProjectState } from "./types";

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

function matchesExperiment(target: ProjectState, experimentId: unknown, recordId: number) {
  return target.experiments.find((experiment) =>
    typeof experimentId === "string" && experimentId
      ? experiment.formData.experiment_id === experimentId || experiment.name === experimentId
      : experiment.id === recordId,
  );
}

function importSelection(target: ProjectState, incoming: ProjectState): ImportSelection {
  const experiments = incoming.experiments.filter((experiment) => {
    const existing = matchesExperiment(target, experiment.formData.experiment_id, experiment.id);
    return !existing || !equalData(existing.formData, experiment.formData);
  });
  const importKeys = new Map(
    experiments.map((experiment, index) => [experiment.id, `experiment-${index}`]),
  );
  const matchedDatasets = new Set<number>();
  const linkedExperimentKey = (state: ProjectState, dataset: DatasetRecord) => {
    const id = dataset.linking?.linkedExperimentInternalId;
    if (id == null) return null;
    const experiment = state.experiments.find((record) => record.id === id);
    return experiment?.formData.experiment_id || `internal:${id}`;
  };
  const datasetContent = (dataset: DatasetRecord) => {
    // applyImport derives these IDs from the target project and link, not the source file.
    const { project_id: _, experiment_id: __, ...content } = dataset.formData;
    return content;
  };
  const datasets = incoming.datasets
    .filter((dataset) => {
      const index = target.datasets.findIndex(
        (existing, index) =>
          !matchedDatasets.has(index) &&
          equalData(datasetContent(existing), datasetContent(dataset)) &&
          linkedExperimentKey(target, existing) === linkedExperimentKey(incoming, dataset),
      );
      if (index < 0) return true;
      matchedDatasets.add(index);
      return false;
    })
    .map((dataset: DatasetRecord) => {
      const linkedId = dataset.linking?.linkedExperimentInternalId;
      const linkedExperiment = incoming.experiments.find(
        (experiment) => experiment.id === linkedId,
      );
      const linkedKey = typeof linkedId === "number" ? importKeys.get(linkedId) : undefined;
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

/** Uses the established import rules, deduplicating datasets so retries are idempotent. */
export function mergeProjectRecord(target: ProjectRecord, incoming: ProjectRecord): ProjectRecord {
  const state = applyImport(target.state, importSelection(target.state, incoming.state));
  if (equalData(state, target.state)) return target;
  return {
    ...target,
    state,
    createdAt: Math.min(target.createdAt, incoming.createdAt),
    updatedAt: Math.max(Date.now(), target.updatedAt + 1, incoming.updatedAt),
  };
}

function conflict(field: string): never {
  throw new Error(
    `Conflicting changes to ${field} on another device. Your edits are still in memory; export them before reloading.`,
  );
}

function reconcileEntities<T extends ExperimentRecord | DatasetRecord>(
  local: T[],
  remote: T[],
  base: T[],
): { target: T[]; incoming: T[] } {
  let target = [...local];
  let incoming = [...remote];
  const content = ({ createdAt: _, updatedAt: __, ...data }: T) => data;
  for (const original of base) {
    const a = local.find((entity) => entity.id === original.id);
    const b = remote.find((entity) => entity.id === original.id);
    const localChanged = !a || !equalData(content(a), content(original));
    const remoteChanged = !b || !equalData(content(b), content(original));
    if (localChanged && remoteChanged && (!a || !b || !equalData(content(a), content(b)))) {
      if (a || b) conflict(`entity "${original.name}"`);
    }
    if (!b) {
      target = target.filter((entity) => entity.id !== original.id);
    } else if (remoteChanged && !localChanged) {
      target = target.map((entity) => (entity.id === original.id ? b : entity));
    }
    // Baseline records are reconciled by stable identity, not imported again as new datasets.
    incoming = incoming.filter((entity) => entity.id !== original.id);
  }
  return { target, incoming };
}

/** Reconciles disjoint changes; overlapping edits remain unsaved instead of being overwritten. */
export function reconcileProjectRecord(
  local: ProjectRecord,
  remote: ProjectRecord,
  base: ProjectRecord,
): ProjectRecord {
  const projectData = { ...local.state.projectData };
  for (const key of new Set([
    ...Object.keys(base.state.projectData),
    ...Object.keys(remote.state.projectData),
  ])) {
    const original = base.state.projectData[key];
    const incoming = remote.state.projectData[key];
    const current = local.state.projectData[key];
    if (equalData(incoming, original)) continue;
    if (!equalData(current, original) && !equalData(current, incoming))
      conflict(`project field "${key}"`);
    if (key in remote.state.projectData) projectData[key] = incoming;
    else delete projectData[key];
  }
  const experiments = reconcileEntities(
    local.state.experiments,
    remote.state.experiments,
    base.state.experiments,
  );
  const datasets = reconcileEntities(
    local.state.datasets,
    remote.state.datasets,
    base.state.datasets,
  );
  for (const incoming of remote.state.experiments) {
    if (base.state.experiments.some((original) => original.id === incoming.id)) continue;
    const localAddition = matchesExperiment(
      {
        ...local.state,
        experiments: local.state.experiments.filter(
          (experiment) => !base.state.experiments.some((original) => original.id === experiment.id),
        ),
      },
      incoming.formData.experiment_id,
      incoming.id,
    );
    if (localAddition && !equalData(localAddition.formData, incoming.formData)) {
      conflict(`new experiment "${incoming.name}"`);
    }
  }
  const target = {
    ...local,
    state: {
      ...local.state,
      projectData,
      experiments: experiments.target,
      datasets: datasets.target,
    },
  };
  const incomingExperiments = remote.state.experiments.flatMap((experiment) => {
    if (!base.state.experiments.some((original) => original.id === experiment.id))
      return [experiment];
    const reconciled = experiments.target.find((record) => record.id === experiment.id);
    return reconciled ? [reconciled] : [];
  });
  return mergeProjectRecord(target, {
    ...remote,
    state: {
      ...remote.state,
      projectData: {},
      experiments: incomingExperiments,
      datasets: datasets.incoming,
    },
  });
}
