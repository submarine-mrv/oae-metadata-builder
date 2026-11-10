import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { applyImport, type ImportSelection } from "@/utils/applyImport";
import { fieldLabel } from "@/utils/fieldLabels";
import { propagateExperimentIdToDatasets, propagateProjectId } from "@/utils/idPropagation";
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

export function equalData(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

/** An experiment's or dataset's data without its timestamps. */
function entityContent<T extends ExperimentRecord | DatasetRecord>({
  createdAt: _,
  updatedAt: __,
  ...data
}: T) {
  return data;
}

function matchesExperiment(target: ProjectState, experimentId: unknown, recordId: string) {
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
      const linkedKey = typeof linkedId === "string" ? importKeys.get(linkedId) : undefined;
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

/** Which side wins where both edited the same thing; unset means throw a conflict. */
export type ConflictPreference = "local" | "remote";

function conflict(field: string): never {
  throw new Error(`Newer changes also edited ${field}.`);
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
  prefer?: ConflictPreference,
): T {
  const [current, incoming, original] = [local, remote, base] as Record<string, unknown>[];
  const merged = { ...current };
  for (const key of new Set([...Object.keys(original), ...Object.keys(incoming)])) {
    if (equalData(incoming[key], original[key])) continue;
    if (!equalData(current[key], original[key]) && !equalData(current[key], incoming[key])) {
      if (!prefer) conflict(label(key));
      if (prefer === "local") continue;
    }
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
  prefer?: ConflictPreference,
): T[] {
  let target = [...local];
  const content = ({ createdAt: _, updatedAt: __, ...data }: T) => data;
  const details = ({ createdAt: _, updatedAt: __, formData: ___, ...data }: T) => data;
  for (const original of base) {
    const a = local.find((entity) => entity.id === original.id);
    const b = remote.find((entity) => entity.id === original.id);
    if (!a || !b) {
      // Deletes win on either side, even over an edit: drop it and never import it back.
      target = target.filter((entity) => entity.id !== original.id);
      continue;
    }
    const localChanged = !equalData(content(a), content(original));
    const remoteChanged = !equalData(content(b), content(original));
    if (localChanged && remoteChanged && !equalData(content(a), content(b))) {
      // Other fields depend on the type, so a type change can't merge with other edits.
      const typeKey = kind === "experiment" ? "experiment_types" : "dataset_type";
      const formData = (entity: T) => entity.formData as Record<string, unknown>;
      if (
        !equalData(formData(a)[typeKey], formData(original)[typeKey]) ||
        !equalData(formData(b)[typeKey], formData(original)[typeKey])
      ) {
        if (!prefer) conflict(`the type of ${kind} "${original.name}"`);
        const winner = prefer === "local" ? a : b;
        target = target.map((entity) => (entity.id === original.id ? winner : entity));
        continue;
      }
      const label = (key: string) => `"${fieldLabel(kind, key)}" in ${kind} "${original.name}"`;
      const merged = {
        ...a,
        ...mergeFields(details(a), details(b), details(original), label, prefer),
        formData: mergeFields(a.formData, b.formData, original.formData, label, prefer),
        updatedAt: Math.max(a.updatedAt, b.updatedAt),
      } as T;
      target = target.map((entity) => (entity.id === original.id ? merged : entity));
    } else if (remoteChanged && !localChanged) {
      target = target.map((entity) => (entity.id === original.id ? b : entity));
    }
  }
  return target;
}

/** Entities added on one side since the baseline. */
function additions<T extends { id: string }>(side: T[], base: T[]): T[] {
  return side.filter((entity) => !base.some((original) => original.id === entity.id));
}

/** Datasets keep the public experiment_id of the experiment they link to. */
function refreshLinkedExperimentIds(state: ProjectState): ProjectState {
  let datasets = state.datasets;
  for (const experiment of state.experiments) {
    const stale = datasets.some(
      (dataset) =>
        dataset.linking?.linkedExperimentInternalId === experiment.id &&
        (dataset.formData.experiment_id || undefined) !==
          (experiment.formData.experiment_id || undefined),
    );
    if (stale) {
      datasets = propagateExperimentIdToDatasets(
        datasets,
        experiment.id,
        experiment.formData.experiment_id,
      );
    }
  }
  return datasets === state.datasets ? state : { ...state, datasets };
}

/**
 * Reconciles disjoint changes. Overlapping edits throw a conflict, or with `prefer` take that
 * side's value for just those fields. Additions on either side keep their UUIDs.
 */
export function reconcileProjectRecord(
  local: ProjectRecord,
  remote: ProjectRecord,
  base: ProjectRecord,
  prefer?: ConflictPreference,
): ProjectRecord {
  const projectData = mergeFields(
    local.state.projectData,
    remote.state.projectData,
    base.state.projectData,
    (key) => `"${fieldLabel("project", key)}"`,
    prefer,
  );
  let experiments = reconcileEntities(
    "experiment",
    local.state.experiments,
    remote.state.experiments,
    base.state.experiments,
    prefer,
  );
  let datasets = reconcileEntities(
    "dataset",
    local.state.datasets,
    remote.state.datasets,
    base.state.datasets,
    prefer,
  );
  const replaced = new Map<string, ExperimentRecord | DatasetRecord>();
  // A save that went through but whose reply was lost comes back as a "remote" addition
  // this tab already has. Identical copies are the same entity; with no shared baseline,
  // differing copies are a conflict.
  const newRemote = <T extends ExperimentRecord | DatasetRecord>(
    kind: "experiment" | "dataset",
    side: T[],
    original: T[],
    own: T[],
  ) =>
    additions(side, original).filter((entity) => {
      const mine = own.find((candidate) => candidate.id === entity.id);
      if (mine && !equalData(entityContent(mine), entityContent(entity))) {
        if (!prefer) conflict(`the ${kind} "${entity.name}"`);
        if (prefer === "remote") replaced.set(entity.id, entity);
      }
      return !mine;
    });
  const remoteExperiments = newRemote(
    "experiment",
    remote.state.experiments,
    base.state.experiments,
    local.state.experiments,
  );
  const remoteDatasets = newRemote(
    "dataset",
    remote.state.datasets,
    base.state.datasets,
    local.state.datasets,
  );
  const swap = <T extends { id: string }>(list: T[]) =>
    list.map((entity) => (replaced.get(entity.id) as T | undefined) ?? entity);
  experiments = swap(experiments);
  datasets = swap(datasets);
  // With a preference both additions are kept, even with the same experiment ID, so nothing is lost.
  for (const incoming of prefer ? [] : remoteExperiments) {
    const publicId = incoming.formData.experiment_id;
    if (publicId && experiments.some((e) => e.formData.experiment_id === publicId)) {
      conflict(`the experiment "${incoming.name}"`);
    }
  }
  const projectId = projectData.project_id as string | undefined;
  const allExperiments = propagateProjectId([...experiments, ...remoteExperiments], projectId);
  const allDatasets = propagateProjectId([...datasets, ...remoteDatasets], projectId);
  const state = refreshLinkedExperimentIds({
    ...local.state,
    projectData,
    experiments: allExperiments,
    datasets: allDatasets,
  });
  if (equalData(state, local.state)) return local;
  return {
    ...local,
    state,
    createdAt: Math.min(local.createdAt, remote.createdAt),
    updatedAt: Math.max(Date.now(), local.updatedAt + 1, remote.updatedAt),
  };
}
