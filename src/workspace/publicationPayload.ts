import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { getProtocolMetadata } from "@/utils/schemaViews";
import { validateDataset, validateExperiment, validateProject } from "@/utils/validation";
import type { ProjectRecord } from "./types";

export type JsonRecord = Record<string, unknown>;

type ExperimentPublicationRow = JsonRecord & {
  project_id: string;
  experiment_id: string;
};

type DatasetPublicationRow = JsonRecord & {
  project_id: string;
  experiment_id: string;
  name: string;
};

export type ProjectPublicationPayload = {
  project: JsonRecord;
  experiments: ExperimentPublicationRow[];
  datasets: DatasetPublicationRow[];
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required before publication.`);
  }
  return value.trim();
}

function validationMessage(label: string, errors: Array<{ property?: string; message?: string }>) {
  const details = errors.map((error) => `${error.property ?? ""} ${error.message ?? "is invalid"}`);
  return `${label} is not valid for publication: ${details.join("; ")}`;
}

function assertValid(
  label: string,
  validation: { isValid: boolean; errors: Array<{ property?: string; message?: string }> },
) {
  if (!validation.isValid) throw new Error(validationMessage(label, validation.errors));
}

function objectOrNull(value: unknown): JsonRecord | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Dataset platform_info must be an object when provided.");
  }
  return value as JsonRecord;
}

function timestamp(value: unknown, field: string, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === "")) return null;
  const input = requiredString(value, field);
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${field} must be a valid date and time before publication.`);
  }
  return parsed.toISOString();
}

function sourceExtras(source: JsonRecord) {
  return { _source: source };
}

function mapExperiment(projectId: string, experiment: ExperimentRecord): ExperimentPublicationRow {
  const data = experiment.formData;
  const experimentId = requiredString(data.experiment_id, "Experiment ID");
  if (data.project_id !== projectId) {
    throw new Error(`Experiment "${experimentId}" is not linked to project "${projectId}".`);
  }
  return {
    project_id: projectId,
    experiment_id: experimentId,
    name: requiredString(data.name ?? experiment.name, `Experiment "${experimentId}" name`),
    description: requiredString(data.description, `Experiment "${experimentId}" description`),
    spatial_coverage: data.spatial_coverage,
    experiment_types: data.experiment_types,
    experiment_leads: data.experiment_leads,
    start_datetime: timestamp(data.start_datetime, `Experiment "${experimentId}" start date`),
    end_datetime: timestamp(data.end_datetime, `Experiment "${experimentId}" end date`, true),
    extras: sourceExtras(data),
  };
}

function mapDataset(projectId: string, dataset: DatasetRecord): DatasetPublicationRow {
  const data = dataset.formData;
  const datasetName = requiredString(data.name ?? dataset.name, "Dataset name");
  const experimentId = requiredString(data.experiment_id, `Dataset "${datasetName}" experiment ID`);
  if (data.project_id !== projectId) {
    throw new Error(`Dataset "${datasetName}" is not linked to project "${projectId}".`);
  }
  return {
    project_id: projectId,
    experiment_id: experimentId,
    name: datasetName,
    description: requiredString(data.description, `Dataset "${datasetName}" description`),
    data_product_type: data.data_product_type ?? null,
    filenames: data.filenames,
    dataset_type: requiredString(data.dataset_type, `Dataset "${datasetName}" type`),
    platform_info: objectOrNull(data.platform_info),
    simulation_type: data.simulation_type ?? null,
    mcdr_forcing_description: data.mcdr_forcing_description ?? null,
    data_submitter: data.data_submitter,
    data_access_link: data.data_access_link ?? null,
    data_accessibility: requiredString(
      data.data_accessibility,
      `Dataset "${datasetName}" data accessibility`,
    ),
    extras: sourceExtras(data),
  };
}

function validateChildren<T>(
  label: string,
  records: T[],
  validate: (record: T) => {
    isValid: boolean;
    errors: Array<{ property?: string; message?: string }>;
  },
) {
  for (const [index, record] of records.entries()) {
    assertValid(`${label} ${index + 1}`, validate(record));
  }
}

export function buildProjectPublicationPayload(project: ProjectRecord): ProjectPublicationPayload {
  const { projectData, experiments, datasets } = project.state;
  const projectId = requiredString(projectData.project_id, "Project ID");
  const metadata = getProtocolMetadata();

  assertValid("Project", validateProject(projectData));
  const mappedExperiments = experiments.map((experiment) => mapExperiment(projectId, experiment));
  validateChildren("Experiment", experiments, (experiment) =>
    validateExperiment(experiment.formData),
  );
  const mappedDatasets = datasets.map((dataset) => mapDataset(projectId, dataset));
  validateChildren("Dataset", datasets, (dataset) =>
    validateDataset(dataset.formData, { hasExperiments: experiments.length > 0 }),
  );

  if (!metadata.version || !metadata.gitHash) {
    throw new Error("Protocol version metadata is missing; this project cannot be published.");
  }

  const experimentIds = mappedExperiments.map((experiment) => experiment.experiment_id);
  if (new Set(experimentIds).size !== experimentIds.length) {
    throw new Error("Experiment IDs must be unique within a project before publication.");
  }

  const experimentIdSet = new Set(experimentIds);
  for (const dataset of mappedDatasets) {
    if (!experimentIdSet.has(dataset.experiment_id)) {
      throw new Error(
        `Dataset "${dataset.name}" must link to an experiment in this project before publication.`,
      );
    }
  }

  const projectSource = projectData as JsonRecord;
  return {
    project: {
      project_id: projectId,
      protocol_version: metadata.version,
      protocol_git_hash: metadata.gitHash,
      description: requiredString(projectData.description, "Project description"),
      temporal_coverage: requiredString(projectData.temporal_coverage, "Project temporal coverage"),
      spatial_coverage: projectData.spatial_coverage,
      project_leads: projectData.project_leads,
      mcdr_pathway: requiredString(projectData.mcdr_pathway, "Project MCDR pathway"),
      extras: {
        _source_file: `${projectId}.json`,
        metadata_builder_git_hash: "",
        ...sourceExtras(projectSource),
      },
    },
    experiments: mappedExperiments,
    datasets: mappedDatasets,
  };
}
