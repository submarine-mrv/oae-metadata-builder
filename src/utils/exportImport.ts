import { ExperimentData } from "@/contexts/AppStateContext";

/**
 * Exports project and experiment data in the project schema format
 * with experiments nested in the "experiments" field
 */
export function exportMetadata(
  projectData: any,
  experiments: ExperimentData[]
): void {
  // Combine project data with experiment form data
  const exportData = {
    ...projectData,
    experiments: experiments.map((exp) => exp.formData)
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
 * Imports project and experiment data from a JSON file
 * Returns an object with project data and experiments array
 */
export async function importMetadata(
  file: File
): Promise<{ projectData: any; experiments: ExperimentData[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Extract experiments array (if it exists)
        const experimentsData = data.experiments || [];

        // Remove experiments from project data
        const { experiments: _, ...projectData } = data;

        // Convert experiment data to ExperimentData format
        const experiments: ExperimentData[] = experimentsData.map(
          (expData: any, index: number) => ({
            id: index + 1, // Will be reassigned based on nextExperimentId
            name: expData.name || expData.experiment_id || `Experiment ${index + 1}`,
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