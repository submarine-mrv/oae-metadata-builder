import {
  ExperimentData,
  ProjectFormData,
  ExperimentFormData
} from "@/types/forms";
import { getProtocolMetadata } from "./schemaViews";

/**
 * Project schema fields that should be in the root project data
 */
const PROJECT_FIELDS: (keyof ProjectFormData)[] = [
  "project_id",
  "project_description",
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
function cleanProjectData(data: Record<string, unknown>): ProjectFormData {
  const cleaned: Record<string, unknown> = {};
  PROJECT_FIELDS.forEach((field) => {
    if (data[field] !== undefined) {
      cleaned[field] = data[field];
    }
  });
  return cleaned as ProjectFormData;
}

export interface ExportData {
  version: string;
  protocol_git_hash: string;
  metadata_builder_git_hash: string;
  project: ProjectFormData & {
    experiments: ExperimentFormData[];
  };
}

/**
 * Exports project and experiment data wrapped in a Container object
 * with version metadata from the protocol
 */
export function exportMetadata(
  projectData: ProjectFormData,
  experiments: ExperimentData[]
): void {
  // Get version metadata from schema
  const protocolMetadata = getProtocolMetadata();

  // Clean project data to remove any experiment fields
  const cleanedProjectData = cleanProjectData(projectData as Record<string, unknown>);

  // Combine clean project data with experiment form data
  const projectWithExperiments = {
    ...cleanedProjectData,
    experiments: experiments.map((exp) => exp.formData)
  };

  // Wrap in Container object
  const exportData: ExportData = {
    version: protocolMetadata.version,
    protocol_git_hash: protocolMetadata.gitHash,
    metadata_builder_git_hash: "", // Leave empty for now
    project: projectWithExperiments
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
 * Imports project and experiment data from a JSON file in Container format
 * Returns an object with project data and experiments array
 */
export async function importMetadata(
  file: File
): Promise<{ projectData: ProjectFormData; experiments: ExperimentData[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ExportData;

        // Expect Container format: { version, protocol_git_hash, project: {...} }
        const projectDataRaw = data.project || {};
        const experimentsData = projectDataRaw.experiments || [];

        // Remove experiments from project data and clean to only keep Project fields
        const { experiments: _, ...rawProjectData } = projectDataRaw;
        const projectData = cleanProjectData(rawProjectData as Record<string, unknown>);

        // Convert experiment data to ExperimentData format
        const experiments: ExperimentData[] = experimentsData.map(
          (expData: ExperimentFormData, index: number) => ({
            id: index + 1, // Will be reassigned based on nextExperimentId
            name: (expData as Record<string, unknown>).name as string || expData.experiment_id || `Experiment ${index + 1}`,
            formData: expData,
            experiment_type: expData.experiment_type,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        );

        resolve({ projectData, experiments });
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