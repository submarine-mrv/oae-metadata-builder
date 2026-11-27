import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { applyImport, type ImportSelection } from "@/utils/applyImport";
import { fieldLabel } from "@/utils/fieldLabels";
import { propagateExperimentIdToDatasets, propagateProjectId } from "@/utils/idPropagation";
import type { DiffSide } from "@/utils/jsonDiff";
import { variableUuid } from "@/utils/variableUuid";
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

/** One side's value; a missing property is distinct from `null`. */
export type ConflictValue = DiffSide;

/** Something both sides changed differently, settled by choosing one side's whole value. */
export interface SyncConflict {
  /** Stable across label changes: kind, internal ID, part and field. */
  key: string;
  /** `field` settles one field; `entity` and `project` replace that whole item. */
  scope: "field" | "entity" | "project";
  kind: "project" | "experiment" | "dataset";
  entityId?: string;
  /** Where it is, e.g. `Experiment "Trial"`. */
  group: string;
  /** What it is, e.g. a field label. */
  label: string;
  /** The same wording the conflict error uses. */
  message: string;
  local: ConflictValue;
  remote: ConflictValue;
}

/** Settles each conflict: one side for all, or a choice per conflict (unset leaves it unresolved). */
export type ConflictResolver =
  | ConflictPreference
  | ((conflict: SyncConflict) => ConflictPreference | undefined);

const sideOf = (record: Record<string, unknown>, key: string): ConflictValue =>
  record[key] !== undefined ? { present: true, value: record[key] } : { present: false };

const conflictKey = (kind: string, entityId: string | null, part: string, field: string) =>
  JSON.stringify([kind, entityId, part, field]);

function conflictError(entry: SyncConflict) {
  return new Error(`Newer changes also edited ${entry.message}.`);
}

/** The chosen side for `entry`, or throws when no choice was made. */
function decide(entry: SyncConflict, resolver?: ConflictResolver): ConflictPreference {
  const choice = typeof resolver === "function" ? resolver(entry) : resolver;
  if (!choice) throw conflictError(entry);
  return choice;
}

/** The whole-project choice when there is no shared baseline (or one side is gone). */
export function projectConflict(local?: ProjectRecord, remote?: ProjectRecord): SyncConflict {
  const side = (record?: ProjectRecord): ConflictValue =>
    record ? { present: true, value: record.state } : { present: false };
  return {
    key: conflictKey("project", null, "record", ""),
    scope: "project",
    kind: "project",
    group: "Project",
    label: "Whole project",
    message: "this project",
    local: side(local),
    remote: side(remote),
  };
}

/** With no shared baseline, only an identical copy can be adopted safely. */
export function adoptUnseenProject(local: ProjectRecord, remote: ProjectRecord): ProjectRecord {
  if (!equalData(local.state, remote.state)) throw conflictError(projectConflict(local, remote));
  return remote;
}

type FieldContext = {
  kind: SyncConflict["kind"];
  entityId: string | null;
  part: "formData" | "record";
  group: string;
  label: (key: string) => string;
  message: (key: string) => string;
};

/** Each variable keyed by its UUID, or null when any lacks one. */
function variablesByUuid(value: unknown): Map<string, unknown> | null {
  if (value === undefined) return new Map();
  if (!Array.isArray(value)) return null;
  const entries = value.map((variable) => [variableUuid(variable), variable] as const);
  if (entries.some(([uuid]) => uuid === undefined)) return null;
  const byUuid = new Map(entries as [string, unknown][]);
  return byUuid.size === entries.length ? byUuid : null;
}

/**
 * Three-way merge of a dataset's variables, one variable at a time. Deletes win, as they do for
 * entities. Local order is kept; variables new in the cloud follow it. Returns undefined when a
 * side has variables without UUIDs, so the caller merges the list as one field.
 */
function mergeVariables(
  local: unknown,
  remote: unknown,
  base: unknown,
  context: FieldContext,
  resolver?: ConflictResolver,
): { value: unknown[] } | undefined {
  const [current, incoming, original] = [local, remote, base].map(variablesByUuid);
  if (!current || !incoming || !original) return undefined;
  const merged: unknown[] = [];
  const name = (variable: unknown) =>
    (variable as Record<string, unknown>).dataset_variable_name || "(unnamed)";
  for (const [uuid, mine] of current) {
    const theirs = incoming.get(uuid);
    if (!original.has(uuid)) {
      merged.push(mine);
      continue;
    }
    if (theirs === undefined) continue;
    const before = original.get(uuid);
    if (equalData(theirs, before) || equalData(mine, theirs)) {
      merged.push(mine);
      continue;
    }
    if (!equalData(mine, before)) {
      const entry: SyncConflict = {
        key: conflictKey(context.kind, context.entityId, context.part, `variables.${uuid}`),
        scope: "field",
        kind: context.kind,
        ...(context.entityId ? { entityId: context.entityId } : {}),
        group: context.group,
        label: `Variable "${name(mine)}"`,
        message: context.message("variables"),
        local: { present: true, value: mine },
        remote: { present: true, value: theirs },
      };
      if (decide(entry, resolver) === "local") {
        merged.push(mine);
        continue;
      }
    }
    merged.push(theirs);
  }
  for (const [uuid, theirs] of incoming) {
    if (!original.has(uuid) && !current.has(uuid)) merged.push(theirs);
  }
  return { value: merged };
}

/** Three-way merge of top-level fields: take whichever side changed; both changing one field conflicts. */
function mergeFields<T extends object>(
  local: T,
  remote: T,
  base: T,
  context: FieldContext,
  resolver?: ConflictResolver,
): T {
  const [current, incoming, original] = [local, remote, base] as Record<string, unknown>[];
  const merged = { ...current };
  for (const key of new Set([...Object.keys(original), ...Object.keys(incoming)])) {
    if (equalData(incoming[key], original[key])) continue;
    if (key === "variables" && context.part === "formData") {
      const variables = mergeVariables(
        current[key],
        incoming[key],
        original[key],
        context,
        resolver,
      );
      if (variables) {
        if (variables.value.length || key in current || key in incoming) {
          merged[key] = variables.value;
        }
        continue;
      }
    }
    if (!equalData(current[key], original[key]) && !equalData(current[key], incoming[key])) {
      const entry: SyncConflict = {
        key: conflictKey(context.kind, context.entityId, context.part, key),
        scope: "field",
        kind: context.kind,
        ...(context.entityId ? { entityId: context.entityId } : {}),
        group: context.group,
        label: context.label(key),
        message: context.message(key),
        local: sideOf(current, key),
        remote: sideOf(incoming, key),
      };
      if (decide(entry, resolver) === "local") continue;
    }
    if (key in incoming) merged[key] = incoming[key];
    else delete merged[key];
  }
  return merged as T;
}

const kindName = (kind: "experiment" | "dataset") =>
  kind === "experiment" ? "Experiment" : "Dataset";

function entityConflict<T extends ExperimentRecord | DatasetRecord>(
  kind: "experiment" | "dataset",
  local: T | undefined,
  remote: T,
  message: string,
): SyncConflict {
  const side = (entity?: T): ConflictValue =>
    entity ? { present: true, value: entityContent(entity) } : { present: false };
  return {
    key: conflictKey(kind, remote.id, "record", ""),
    scope: "entity",
    kind,
    entityId: remote.id,
    group: `${kindName(kind)} "${(local ?? remote).name}"`,
    label: `Whole ${kind}`,
    message,
    local: side(local),
    remote: side(remote),
  };
}

function reconcileEntities<T extends ExperimentRecord | DatasetRecord>(
  kind: "experiment" | "dataset",
  local: T[],
  remote: T[],
  base: T[],
  resolver?: ConflictResolver,
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
        const entry = entityConflict(
          kind,
          a,
          b,
          `the type of ${kind} "${original.name}", so the version you choose replaces that whole ${kind}`,
        );
        const winner = decide(entry, resolver) === "local" ? a : b;
        target = target.map((entity) => (entity.id === original.id ? winner : entity));
        continue;
      }
      const context = (part: FieldContext["part"]): FieldContext => ({
        kind,
        entityId: original.id,
        part,
        group: `${kindName(kind)} "${original.name}"`,
        label: (key) => fieldLabel(kind, key),
        message: (key) => `"${fieldLabel(kind, key)}" in ${kind} "${original.name}"`,
      });
      const merged = {
        ...a,
        ...mergeFields(details(a), details(b), details(original), context("record"), resolver),
        formData: mergeFields(
          a.formData,
          b.formData,
          original.formData,
          context("formData"),
          resolver,
        ),
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
 * Reconciles disjoint changes. Overlapping edits throw a conflict, or with a `resolver` take the
 * chosen side's value for just those fields. Additions on either side keep their UUIDs.
 */
export function reconcileProjectRecord(
  local: ProjectRecord,
  remote: ProjectRecord,
  base: ProjectRecord,
  resolver?: ConflictResolver,
): ProjectRecord {
  const projectData = mergeFields(
    local.state.projectData,
    remote.state.projectData,
    base.state.projectData,
    {
      kind: "project",
      entityId: null,
      part: "formData",
      group: "Project",
      label: (key) => fieldLabel("project", key),
      message: (key) => `"${fieldLabel("project", key)}"`,
    },
    resolver,
  );
  let experiments = reconcileEntities(
    "experiment",
    local.state.experiments,
    remote.state.experiments,
    base.state.experiments,
    resolver,
  );
  let datasets = reconcileEntities(
    "dataset",
    local.state.datasets,
    remote.state.datasets,
    base.state.datasets,
    resolver,
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
        const entry = entityConflict(kind, mine, entity, `the ${kind} "${entity.name}"`);
        if (decide(entry, resolver) === "remote") replaced.set(entity.id, entity);
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
  // With any resolver both additions are kept, even with the same experiment ID, so nothing is lost.
  for (const incoming of resolver ? [] : remoteExperiments) {
    const publicId = incoming.formData.experiment_id;
    if (publicId && experiments.some((e) => e.formData.experiment_id === publicId)) {
      throw new Error(`Newer changes also edited the experiment "${incoming.name}".`);
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

/**
 * Every conflict `reconcileProjectRecord` would raise, in order. Without a baseline, any
 * difference is one whole-project choice.
 */
export function collectProjectConflicts(
  local: ProjectRecord,
  remote: ProjectRecord,
  base?: ProjectRecord,
): SyncConflict[] {
  if (!base) return equalData(local.state, remote.state) ? [] : [projectConflict(local, remote)];
  const conflicts: SyncConflict[] = [];
  reconcileProjectRecord(local, remote, base, (entry) => {
    conflicts.push(entry);
    // Keeping this side leaves the traversal over the same items, so every clash is visited.
    return "local";
  });
  return conflicts;
}
