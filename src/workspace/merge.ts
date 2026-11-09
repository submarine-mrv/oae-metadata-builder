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
    `Conflicting changes to ${field} elsewhere. Your edits are still in memory; export them before reloading.`,
  );
}

/** With no shared baseline, only an identical copy can be adopted safely. */
export function adoptUnseenProject(local: ProjectRecord, remote: ProjectRecord): ProjectRecord {
  if (!equalData(local.state, remote.state)) conflict("this project");
  return remote;
}

/** Three-way merge of top-level fields: take whichever side changed; both changing one field conflicts. */
function mergeFields<T extends object>(
  local: T,
  remote: T,
  base: T,
  label: (key: string) => string,
): T {
  const [current, incoming, original] = [local, remote, base] as Record<string, unknown>[];
  const merged = { ...current };
  for (const key of new Set([...Object.keys(original), ...Object.keys(incoming)])) {
    if (equalData(incoming[key], original[key])) continue;
    if (!equalData(current[key], original[key]) && !equalData(current[key], incoming[key]))
      conflict(label(key));
    if (key in incoming) merged[key] = incoming[key];
    else delete merged[key];
  }
  return merged as T;
}

function reconcileEntities<T extends ExperimentRecord | DatasetRecord>(
  kind: "experiment" | "dataset",
  local: T[],
  remote: T[],
  base: T[],
): { target: T[]; incoming: T[] } {
  let target = [...local];
  let incoming = [...remote];
  const content = ({ createdAt: _, updatedAt: __, ...data }: T) => data;
  const details = ({ createdAt: _, updatedAt: __, formData: ___, ...data }: T) => data;
  for (const original of base) {
    const a = local.find((entity) => entity.id === original.id);
    const b = remote.find((entity) => entity.id === original.id);
    if (!a || !b) {
      // Deletes win on either side, even over an edit: drop it and never import it back.
      target = target.filter((entity) => entity.id !== original.id);
      incoming = incoming.filter((entity) => entity.id !== original.id);
      continue;
    }
    const localChanged = !equalData(content(a), content(original));
    const remoteChanged = !equalData(content(b), content(original));
    if (localChanged && remoteChanged && !equalData(content(a), content(b))) {
      const label = (key: string) => `"${key}" in ${kind} "${original.name}"`;
      const merged = {
        ...a,
        ...mergeFields(details(a), details(b), details(original), label),
        formData: mergeFields(a.formData, b.formData, original.formData, label),
        updatedAt: Math.max(a.updatedAt, b.updatedAt),
      } as T;
      target = target.map((entity) => (entity.id === original.id ? merged : entity));
    } else if (remoteChanged && !localChanged) {
      target = target.map((entity) => (entity.id === original.id ? b : entity));
    }
    // Baseline records are reconciled by stable identity, not imported again as new datasets.
    incoming = incoming.filter((entity) => entity.id !== original.id);
  }
  return { target, incoming };
}

/**
 * Both sides number new experiments from the same counter, so two additions can share an ID.
 * Moves the remote ones to unused IDs, links included, so they import as separate experiments.
 */
function renumberCollidingAdditions(
  local: ProjectRecord,
  remote: ProjectRecord,
  base: ProjectRecord,
): ProjectRecord {
  const inBase = new Set(base.state.experiments.map((experiment) => experiment.id));
  const localIds = new Set(local.state.experiments.map((experiment) => experiment.id));
  let next = Math.max(
    local.state.nextExperimentId,
    remote.state.nextExperimentId,
    ...local.state.experiments.map((experiment) => experiment.id + 1),
    ...remote.state.experiments.map((experiment) => experiment.id + 1),
  );
  const moved = new Map<number, number>();
  for (const experiment of remote.state.experiments) {
    if (!inBase.has(experiment.id) && localIds.has(experiment.id)) moved.set(experiment.id, next++);
  }
  if (!moved.size) return remote;
  return {
    ...remote,
    state: {
      ...remote.state,
      experiments: remote.state.experiments.map((experiment) =>
        moved.has(experiment.id)
          ? { ...experiment, id: moved.get(experiment.id) as number }
          : experiment,
      ),
      datasets: remote.state.datasets.map((dataset) => {
        const linkedId = dataset.linking?.linkedExperimentInternalId;
        const movedTo = linkedId == null ? undefined : moved.get(linkedId);
        return movedTo === undefined || !dataset.linking
          ? dataset
          : { ...dataset, linking: { ...dataset.linking, linkedExperimentInternalId: movedTo } };
      }),
    },
  };
}

/** Reconciles disjoint changes; overlapping edits remain unsaved instead of being overwritten. */
export function reconcileProjectRecord(
  local: ProjectRecord,
  latestRemote: ProjectRecord,
  base: ProjectRecord,
): ProjectRecord {
  const remote = renumberCollidingAdditions(local, latestRemote, base);
  const projectData = mergeFields(
    local.state.projectData,
    remote.state.projectData,
    base.state.projectData,
    (key) => `project field "${key}"`,
  );
  const experiments = reconcileEntities(
    "experiment",
    local.state.experiments,
    remote.state.experiments,
    base.state.experiments,
  );
  const datasets = reconcileEntities(
    "dataset",
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
