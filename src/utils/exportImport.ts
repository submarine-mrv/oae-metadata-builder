import { getProtocolMetadata } from "./schemaViews";
import type {
  ProjectFormData,
  ExperimentFormData,
  ExperimentState,
  DatasetFormData,
  DatasetState,
  FormDataRecord,
  ExportContainer,
  ImportResult
} from "@/types/forms";

/**
 * Project schema fields that should be in the root project data
 */
const PROJECT_FIELDS = [
  "project_id",
  "description",
  "mcdr_pathway",
  "sea_names",
  "temporal_coverage",
  "spatial_coverage",
  "vertical_coverage",
  "physical_site_description",
  "social_context_site_description",
  "social_research_conducted_to_date",
  "colocated_operations",
  "previous_or_ongoing_colocated_research",
  "public_comments",
  "permits",
  "research_project",
  "funding",
  "additional_details"
];

/**
 * Cleans projectData to only include valid Project schema fields
 * Removes any experiment-specific fields that may have leaked in
 */
function cleanProjectData(data: FormDataRecord): ProjectFormData {
  const cleaned: ProjectFormData = {};
  PROJECT_FIELDS.forEach((field) => {
    if (data[field] !== undefined) {
      cleaned[field] = data[field];
    }
  });
  return cleaned;
}

/**
 * Options for exporting metadata
 */
export interface ExportOptions {
  /** Which sections to include in the export. Defaults to all sections. */
  selectedSections?: string[];
}

/**
 * Exports project, experiment, and dataset data wrapped in a Container object
 * with version metadata from the protocol.
 *
 * Container structure matches the JSON Schema:
 * - project: single Project object
 * - experiments: array of Experiment objects (top-level, not nested in project)
 * - datasets: array of Dataset objects (top-level)
 *
 * @param projectData - Project form data
 * @param experiments - Array of experiment states
 * @param datasets - Array of dataset states
 * @param options - Export options including section selection
 */
export function exportMetadata(
  projectData: ProjectFormData,
  experiments: ExperimentState[],
  datasets: DatasetState[],
  options?: ExportOptions
): void {
  // Determine which sections to include (default to all)
  const selectedSections = options?.selectedSections || [
    "project",
    "experiment",
    "dataset"
  ];
  const includeProject = selectedSections.includes("project");
  const includeExperiments = selectedSections.includes("experiment");
  const includeDatasets = selectedSections.includes("dataset");

  // Get version metadata from schema
  const protocolMetadata = getProtocolMetadata();

  // Clean project data to remove any experiment fields that may have leaked in
  const cleanedProjectData = includeProject
    ? cleanProjectData(projectData)
    : {};

  // Build Container object matching schema structure
  const exportData: ExportContainer = {
    version: protocolMetadata.version,
    protocol_git_hash: protocolMetadata.gitHash,
    metadata_builder_git_hash: "", // TODO: populate from build metadata
    project: cleanedProjectData,
    experiments: includeExperiments
      ? experiments.map((exp) => exp.formData)
      : [],
    datasets: includeDatasets ? datasets.map((ds) => ds.formData) : []
  };

  // Create blob and download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  // Generate filename with project_id and timestamp
  const projectId = projectData.project_id || "project";
  const timestamp = new Date().toISOString().split("T")[0];
  link.download = `${projectId}-metadata-${timestamp}.json`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imports project, experiment, and dataset data from a JSON file in Container format.
 * Returns an object with project data, experiments array, and datasets array.
 *
 * Supports both formats for backwards compatibility:
 * - New format: experiments and datasets at top level of Container
 * - Old format: experiments nested inside project object
 */
export async function importMetadata(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Extract project data
        const projectDataRaw = data.project || {};

        // Handle experiments - check top level first (new format), then nested (old format)
        let experimentsData: ExperimentFormData[] = [];
        if (Array.isArray(data.experiments) && data.experiments.length > 0) {
          // New format: experiments at top level
          experimentsData = data.experiments;
        } else if (Array.isArray(projectDataRaw.experiments)) {
          // Old format: experiments nested in project
          experimentsData = projectDataRaw.experiments;
        }

        // Handle datasets - only exists in new format
        const datasetsData: DatasetFormData[] = Array.isArray(data.datasets)
          ? data.datasets
          : [];

        // Remove experiments from project data (in case of old format) and clean
        const { experiments: _, ...rawProjectData } = projectDataRaw;
        const projectData = cleanProjectData(rawProjectData);

        // Convert experiment data to ExperimentState format
        const experiments: ExperimentState[] = experimentsData.map(
          (expData: ExperimentFormData, index: number) => ({
            id: index + 1, // Will be reassigned based on nextExperimentId
            name:
              (expData.name as string) ||
              (expData.experiment_id as string) ||
              `Experiment ${index + 1}`,
            formData: expData,
            experiment_type: expData.experiment_type,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        );

        // Convert dataset data to DatasetState format
        const datasets: DatasetState[] = datasetsData.map(
          (dsData: DatasetFormData, index: number) => ({
            id: index + 1, // Will be reassigned based on nextDatasetId
            name:
              (dsData.name as string) ||
              `Dataset ${index + 1}`,
            formData: dsData,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        );

        resolve({ projectData, experiments, datasets });
      } catch (error) {
        reject(new Error(`Failed to parse JSON file: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}