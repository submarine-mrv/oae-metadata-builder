import type { DatasetRecord, ExperimentRecord } from "@/types/forms";
import { buildMetadataDocument } from "@/utils/exportImport";
import { validateDataset, validateExperiment, validateProject } from "@/utils/validation";
import type { ProjectRecord } from "./types";

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export interface ProjectPublicationPayload {
  project: JsonRecord & { project_id: string };
  experiments: Array<JsonRecord & { project_id: string; experiment_id: string }>;
  datasets: Array<JsonRecord & { project_id: string; experiment_id: string; name: string }>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required before publication.`);
  }
  return value;
}

function requiredPersonNames(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} are required before publication.`);
  }
  value.forEach((person, index) => {
    if (!isJsonRecord(person)) {
      throw new Error(`${field} must have valid names before publication.`);
    }
    requiredString(person.name, `${field} ${index + 1} name`);
  });
}

function requiredSpatialBox(value: unknown, field: string) {
  if (!isJsonRecord(value) || !isJsonRecord(value.geo)) {
    throw new Error(`${field} is required before publication.`);
  }
  requiredString(value.geo.box, field);
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
  if (data.spatial_coverage != null) {
    requiredSpatialBox(data.spatial_coverage, `Experiment "${experimentId}" spatial coverage`);
  }
  requiredPersonNames(data.experiment_leads, `Experiment "${experimentId}" leads`);
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
  requiredString(data.description, `Dataset "${name}" description`);
  const submitter = data.data_submitter;
  if (!isJsonRecord(submitter)) {
    throw new Error(`Dataset "${name}" submitter is required before publication.`);
  }
  requiredString(submitter.name, `Dataset "${name}" submitter name`);
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
  requiredPersonNames(projectData.project_leads, "Project leads");
  requiredSpatialBox(projectData.spatial_coverage, "Project spatial coverage");
  const document = buildMetadataDocument(projectData, experiments, datasets);
  if (!document.version) {
    throw new Error("Protocol version metadata is missing; this project cannot be published.");
  }
  const mappedExperiments = experiments.map((experiment) => mapExperiment(projectId, experiment));
  const experimentIds = new Set(mappedExperiments.map((experiment) => experiment.experiment_id));
  if (new Set([...experimentIds].map((id) => id.toLowerCase())).size !== experiments.length) {
    throw new Error("Experiment IDs must be unique before publication.");
  }
  return {
    project: {
      project_id: projectId,
      description: requiredString(projectData.description, "Project description"),
      temporal_coverage: requiredString(projectData.temporal_coverage, "Project temporal coverage"),
      spatial_coverage: projectData.spatial_coverage,
      project_leads: projectData.project_leads,
      mcdr_pathway: requiredString(projectData.mcdr_pathway, "Project MCDR pathway"),
      extras: {
        _source_file: `${projectId}.json`,
        _document: document,
        _source: projectData,
      },
    },
    experiments: mappedExperiments,
    datasets: datasets.map((dataset) => mapDataset(projectId, dataset, experimentIds)),
  };
}
