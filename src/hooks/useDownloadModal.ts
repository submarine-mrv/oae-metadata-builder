import { useState, useCallback } from "react";
import type { DownloadSection } from "@/components/DownloadModal";
import {
  validateProject,
  validateExperiment,
  validateDataset
} from "@/utils/validation";
import { exportMetadata } from "@/utils/exportImport";
import type {
  ProjectFormData,
  ExperimentState,
  DatasetState
} from "@/types/forms";

export type DefaultSelection = "all" | "project" | "experiment" | "dataset";

interface UseDownloadModalProps {
  projectData: ProjectFormData;
  experiments: ExperimentState[];
  datasets: DatasetState[];
  defaultSelection?: DefaultSelection;
}

interface UseDownloadModalReturn {
  showModal: boolean;
  sections: DownloadSection[];
  openModal: () => void;
  closeModal: () => void;
  handleDownload: (selectedSections: string[]) => void;
  handleSectionToggle: (key: string) => void;
}

/**
 * Hook for managing the download modal state and logic.
 * Calculates missing fields for each section and handles the export.
 *
 * @param defaultSelection - Which section(s) to enable by default:
 *   - "all": Enable all sections that have data (for Navigation Export button)
 *   - "project": Only enable project section (for Project page download)
 *   - "experiment": Only enable experiment section (for Experiment page download)
 *   - "dataset": Only enable dataset section (for Dataset page download)
 */
export function useDownloadModal({
  projectData,
  experiments,
  datasets,
  defaultSelection = "all"
}: UseDownloadModalProps): UseDownloadModalReturn {
  const [showModal, setShowModal] = useState(false);
  const [sections, setSections] = useState<DownloadSection[]>([
    {
      key: "project",
      label: "Project",
      missingFields: 0,
      enabled: false
    },
    {
      key: "experiment",
      label: "Experiments",
      missingFields: 0,
      enabled: false
    },
    {
      key: "dataset",
      label: "Datasets",
      missingFields: 0,
      enabled: false
    }
  ]);

  const openModal = useCallback(() => {
    // Check if each section has data
    const hasProjectData = Boolean(projectData?.project_id);
    const hasExperiments = experiments.length > 0;
    const hasDatasets = datasets.length > 0;

    // Validate project using JSON schema validation
    const projectErrors = hasProjectData
      ? validateProject(projectData).errorCount
      : 0;

    // Validate experiments (sum all errors)
    let experimentErrors = 0;
    experiments.forEach((exp) => {
      experimentErrors += validateExperiment(exp.formData).errorCount;
    });

    // Validate datasets (sum all errors)
    let datasetErrors = 0;
    datasets.forEach((ds) => {
      datasetErrors += validateDataset(ds.formData).errorCount;
    });

    // Determine which sections should be enabled by default
    const getDefaultEnabled = (
      sectionKey: string,
      hasData: boolean
    ): boolean => {
      if (!hasData) return false;

      switch (defaultSelection) {
        case "all":
          return true;
        case "project":
          return sectionKey === "project";
        case "experiment":
          return sectionKey === "experiment";
        case "dataset":
          return sectionKey === "dataset";
        default:
          return false;
      }
    };

    setSections([
      {
        key: "project",
        label: "Project",
        missingFields: projectErrors,
        enabled: getDefaultEnabled("project", hasProjectData),
        disabled: !hasProjectData,
        disabledReason: !hasProjectData ? "No project data" : undefined,
        itemCount: 1 // Project is always 1 item
      },
      {
        key: "experiment",
        label: "Experiments",
        missingFields: experimentErrors,
        enabled: getDefaultEnabled("experiment", hasExperiments),
        disabled: !hasExperiments,
        disabledReason: !hasExperiments ? "No experiments created" : undefined,
        itemCount: experiments.length
      },
      {
        key: "dataset",
        label: "Datasets",
        missingFields: datasetErrors,
        enabled: getDefaultEnabled("dataset", hasDatasets),
        disabled: !hasDatasets,
        disabledReason: !hasDatasets ? "No datasets created" : undefined,
        itemCount: datasets.length
      }
    ]);

    setShowModal(true);
  }, [projectData, experiments, datasets, defaultSelection]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleDownload = useCallback(
    (selectedSections: string[]) => {
      exportMetadata(projectData, experiments, datasets, { selectedSections });
      setShowModal(false);
    },
    [projectData, experiments, datasets]
  );

  const handleSectionToggle = useCallback((key: string) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  return {
    showModal,
    sections,
    openModal,
    closeModal,
    handleDownload,
    handleSectionToggle
  };
}
