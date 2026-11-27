import { equalData } from "../merge";
import type { ProjectRecord } from "../types";
import { PROJECT_SCHEMA_VERSION } from "../types";
import type { RemoteProject } from "./types";

/**
 * Maps a project to the cloud's rows and back. The cloud keeps one row for the project and one
 * per experiment and dataset, each with a server-computed content hash. Timestamps travel as
 * epoch milliseconds; list order travels as `position`.
 */

const PROJECT_ROW = "project";

type JsonObject = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalid = () => new Error("The cloud project has an invalid or unsupported format.");

const projectRow = (record: ProjectRecord) => ({
  form_data: record.state.projectData,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const experimentRows = (record: ProjectRecord) =>
  record.state.experiments.map((experiment, position) => ({
    uuid: experiment.id,
    position,
    name: experiment.name,
    form_data: experiment.formData,
    created_at: experiment.createdAt,
    updated_at: experiment.updatedAt,
  }));

const datasetRows = (record: ProjectRecord) => {
  const experiments = new Set(record.state.experiments.map((experiment) => experiment.id));
  return record.state.datasets.map((dataset, position) => {
    const linked = dataset.linking?.linkedExperimentInternalId ?? null;
    return {
      uuid: dataset.id,
      // A link to a deleted experiment is no link, as the cloud stores it.
      experiment_uuid: linked !== null && experiments.has(linked) ? linked : null,
      position,
      name: dataset.name,
      form_data: dataset.formData,
      created_at: dataset.createdAt,
      updated_at: dataset.updatedAt,
    };
  });
};

export interface CloudChanges {
  /** Rewrites the whole project: every kept row is listed and unlisted rows are deleted. */
  replace: boolean;
  project: (ReturnType<typeof projectRow> & { base_hash: string | null }) | null;
  experiments: JsonObject[];
  datasets: JsonObject[];
}

/** Rows changed since `base`, each with the hash it had there. Without a base, every row. */
export function cloudChanges(record: ProjectRecord, base: RemoteProject | null): CloudChanges {
  const rows = base?.rows;
  if (!base || !rows) {
    return {
      replace: true,
      project: { ...projectRow(record), base_hash: null },
      experiments: experimentRows(record),
      datasets: datasetRows(record),
    };
  }
  const diff = (local: { uuid: string }[], remote: { uuid: string }[]) => [
    ...local
      .filter((row) => {
        const before = remote.find((candidate) => candidate.uuid === row.uuid);
        return !before || !equalData(before, row);
      })
      .map((row) => ({ ...row, base_hash: rows[row.uuid] ?? null })),
    ...remote
      .filter((row) => !local.some((candidate) => candidate.uuid === row.uuid))
      .map((row) => ({ uuid: row.uuid, base_hash: rows[row.uuid] ?? null, deleted: true })),
  ];
  const project = projectRow(record);
  return {
    replace: false,
    project: equalData(project, projectRow(base.project))
      ? null
      : { ...project, base_hash: rows[PROJECT_ROW] ?? null },
    experiments: diff(experimentRows(record), experimentRows(base.project)),
    datasets: diff(datasetRows(record), datasetRows(base.project)),
  };
}

export const hasChanges = (changes: CloudChanges) =>
  changes.replace ||
  changes.project !== null ||
  changes.experiments.length > 0 ||
  changes.datasets.length > 0;

const epoch = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw invalid();
  return value;
};

const hashOf = (row: JsonObject, rows: Record<string, string>, key: string) => {
  if (typeof row.content_hash !== "string" || !row.content_hash) throw invalid();
  rows[key] = row.content_hash;
};

/**
 * The project record the cloud state describes, unparsed, with each row's content hash.
 * Callers parse the record, which migrates and validates its data.
 */
export function readCloudState(
  value: unknown,
  projectId: string,
): { record: ProjectRecord; rows: Record<string, string> } {
  if (
    !isRecord(value) ||
    !isRecord(value.project) ||
    !isRecord(value.project.form_data) ||
    !Array.isArray(value.experiments) ||
    !Array.isArray(value.datasets)
  ) {
    throw invalid();
  }
  const rows: Record<string, string> = {};
  hashOf(value.project, rows, PROJECT_ROW);
  const entity = (row: unknown) => {
    if (
      !isRecord(row) ||
      typeof row.uuid !== "string" ||
      typeof row.name !== "string" ||
      !isRecord(row.form_data)
    ) {
      throw invalid();
    }
    hashOf(row, rows, row.uuid);
    return {
      id: row.uuid,
      name: row.name,
      formData: row.form_data,
      createdAt: epoch(row.created_at),
      updatedAt: epoch(row.updated_at),
    };
  };
  const record = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: projectId,
    createdAt: epoch(value.project.created_at),
    updatedAt: epoch(value.project.updated_at),
    state: {
      projectData: value.project.form_data,
      experiments: value.experiments.map(entity),
      datasets: value.datasets.map((row) => {
        const linked = isRecord(row) ? row.experiment_uuid : undefined;
        if (linked !== null && typeof linked !== "string") throw invalid();
        return { ...entity(row), linking: { linkedExperimentInternalId: linked } };
      }),
    },
  };
  return { record: record as unknown as ProjectRecord, rows };
}
