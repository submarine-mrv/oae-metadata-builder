import type { JSONSchema } from "@/components/schemaUtils";
import type {
  DatasetState,
  DraftProject,
  ExperimentState,
  ExportContainer,
  ImportResult,
} from "@/types/forms";
import { trackEvent } from "@/utils/analytics";
import { migrateFormData } from "@/utils/migrations";
import { parseDataset, parseExperiment, parseProject } from "@/utils/parseEntity";
import { getBaseSchema, getProtocolMetadata } from "./schemaViews";

/** Defensive record coercion for entries of imported arrays. */
function asImportRecord(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
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
  projectData: DraftProject,
  experiments: ExperimentState[],
  datasets: DatasetState[],
  options?: ExportOptions,
): void {
  // Determine which sections to include (default to all)
  const selectedSections = options?.selectedSections || ["project", "experiment", "dataset"];
  const includeProject = selectedSections.includes("project");
  const includeExperiments = selectedSections.includes("experiment");
  const includeDatasets = selectedSections.includes("dataset");

  // Get version metadata from schema
  const protocolMetadata = getProtocolMetadata();

  const cleanedProjectData = includeProject ? projectData : {};

  // Build Container object matching schema structure
  const exportData: ExportContainer = {
    version: protocolMetadata.version,
    protocol_git_hash: protocolMetadata.gitHash,
    metadata_builder_git_hash: "", // TODO: populate from build metadata
    project: cleanedProjectData,
    experiments: includeExperiments ? experiments.map((exp) => exp.formData) : [],
    datasets: includeDatasets ? datasets.map((ds) => ds.formData) : [],
  };

  // Create blob and download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
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

  // Counts only, never field values.
  trackEvent("metadata_export", {
    sections: selectedSections.join(","),
    experiments: includeExperiments ? experiments.length : 0,
    datasets: includeDatasets ? datasets.length : 0,
  });
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
        // Raw, untrusted entries — parseExperiment/parseDataset establish types.
        let experimentsData: unknown[] = [];
        if (Array.isArray(data.experiments) && data.experiments.length > 0) {
          // New format: experiments at top level
          experimentsData = data.experiments;
        } else if (Array.isArray(projectDataRaw.experiments)) {
          // Old format: experiments nested in project
          experimentsData = projectDataRaw.experiments;
        }

        // Handle datasets - only exists in new format
        const datasetsData: unknown[] = Array.isArray(data.datasets) ? data.datasets : [];

        // Remove experiments from project data (in case of old format), then
        // migrate legacy bounding box format (W S E N → S W N E) and parse at
        // the import boundary so stored data always carries the entity
        // invariants (model exclusivity, type-scoped fields, clean variables).
        const { experiments: _, ...rawProjectData } = migrateFormData(projectDataRaw);
        const projectData = parseProject(rawProjectData);

        // Convert experiment data to ExperimentState format
        const experiments: ExperimentState[] = experimentsData.map(
          (raw: unknown, index: number) => {
            const expData = parseExperiment(migrateFormData(asImportRecord(raw)));
            return {
              id: index + 1, // Will be reassigned based on nextExperimentId
              name:
                (expData.name as string) ||
                (expData.experiment_id as string) ||
                `Experiment ${index + 1}`,
              formData: expData,
              experiment_types: expData.experiment_types,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
          },
        );

        // Convert dataset data to DatasetState format
        const datasets: DatasetState[] = datasetsData.map((raw: unknown, index: number) => {
          const dsData = parseDataset(
            migrateFormData(asImportRecord(raw)),
            getBaseSchema() as JSONSchema,
          );
          return {
            id: index + 1,
            name: (dsData.name as string) || `Dataset ${index + 1}`,
            formData: dsData,
            linking: {
              linkedExperimentInternalId: null,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        });

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
