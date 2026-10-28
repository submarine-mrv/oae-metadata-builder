import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { buildMetadataDocument } from "@/utils/exportImport";
import { validateDataset, validateExperiment, validateProject } from "@/utils/validation";
import type { ProjectRecord } from "./types";

type JsonRecord = Record<string, unknown>;

export interface ProjectPublicationPayload {
  project: JsonRecord;
  experiments: Array<JsonRecord & { project_id: string; experiment_id: string }>;
  datasets: Array<JsonRecord & { project_id: string; experiment_id: string; name: string }>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required before publication.`);
  }
  return value;
}

function assertValid(
  label: string,
  validation: { isValid: boolean; errors: Array<{ property?: string; message?: string }> },
) {
  if (!validation.isValid) {
    const details = validation.errors
      .map((error) => `${error.property ?? ""} ${error.message ?? "is invalid"}`.trim())
      .join("; ");
    throw new Error(`${label} is not valid for publication: ${details || "validation failed"}`);
  }
}

function timestamp(value: unknown, field: string, optional = false): string | null {
  if (optional && value == null) return null;
  const input = requiredString(value, field);
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${field} must be a valid date and time before publication.`);
  }
  return parsed.toISOString();
}

function mapExperiment(projectId: string, experiment: ExperimentRecord) {
  const data = experiment.formData;
  assertValid(`Experiment "${experiment.name}"`, validateExperiment(data));
  requiredString(data.name, "Experiment name");
  const experimentId = requiredString(data.experiment_id, "Experiment ID");
  if (data.project_id !== projectId) {
    throw new Error(`Experiment "${experimentId}" must link to project "${projectId}".`);
  }
  return {
    project_id: projectId,
    experiment_id: experimentId,
    description: requiredString(data.description, `Experiment "${experimentId}" description`),
    spatial_coverage: data.spatial_coverage ?? null,
    experiment_types: data.experiment_types,
    experiment_leads: data.experiment_leads,
    start_datetime: timestamp(data.start_datetime, `Experiment "${experimentId}" start date`),
    end_datetime: timestamp(data.end_datetime, `Experiment "${experimentId}" end date`, true),
    extras: { _source: data },
  };
}

function mapDataset(projectId: string, dataset: DatasetRecord, experimentIds: Set<string>) {
  const data = dataset.formData;
  assertValid(`Dataset "${dataset.name}"`, validateDataset(data, { hasExperiments: true }));
  const name = requiredString(data.name, "Dataset name");
  const experimentId = requiredString(data.experiment_id, `Dataset "${name}" experiment ID`);
  if (data.project_id !== projectId || !experimentIds.has(experimentId)) {
    throw new Error(`Dataset "${name}" must link to an experiment in project "${projectId}".`);
  }
  return {
    project_id: projectId,
    experiment_id: experimentId,
    name,
    description: data.description ?? null,
    data_product_type: data.data_product_type ?? null,
    filenames: data.filenames ?? null,
    dataset_type: data.dataset_type ?? null,
    platform_info: data.platform_info ?? null,
    simulation_type: data.simulation_type ?? null,
    mcdr_forcing_description: data.mcdr_forcing_description ?? null,
    data_submitter: data.data_submitter,
    data_access_link: data.data_access_link ?? null,
    data_accessibility: data.data_accessibility ?? null,
    extras: { _source: data },
  };
}

export function buildProjectPublicationPayload(project: ProjectRecord): ProjectPublicationPayload {
  const { projectData, experiments, datasets } = project.state;
  assertValid("Project", validateProject(projectData));
  requiredString(projectData.name, "Project name");
  const projectId = requiredString(projectData.project_id, "Project ID");
  const document = buildMetadataDocument(projectData, experiments, datasets);
  if (!document.version || !document.protocol_git_hash) {
    throw new Error("Protocol version metadata is missing; this project cannot be published.");
  }
  const mappedExperiments = experiments.map((experiment) => mapExperiment(projectId, experiment));
  const experimentIds = new Set(mappedExperiments.map((experiment) => experiment.experiment_id));
  if (experimentIds.size !== experiments.length) {
    throw new Error("Experiment IDs must be unique before publication.");
  }
  return {
    project: {
      project_id: projectId,
      protocol_version: document.version,
      protocol_git_hash: document.protocol_git_hash,
      description: requiredString(projectData.description, "Project description"),
      temporal_coverage: requiredString(projectData.temporal_coverage, "Project temporal coverage"),
      spatial_coverage: projectData.spatial_coverage,
      project_leads: projectData.project_leads,
      mcdr_pathway: requiredString(projectData.mcdr_pathway, "Project MCDR pathway"),
      extras: {
        _source_file: `${projectId}.json`,
        metadata_builder_git_hash: document.metadata_builder_git_hash,
        _document: document,
        _source: projectData,
      },
    },
    experiments: mappedExperiments,
    datasets: datasets.map((dataset) => mapDataset(projectId, dataset, experimentIds)),
  };
}
