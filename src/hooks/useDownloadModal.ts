import { useState, useCallback } from "react";
import type { DownloadSection } from "@/components/DownloadModal";
import {
  countMissingProjectFields,
  countMissingExperimentFields,
  countMissingDatasetFields,
  countIncompleteVariables
} from "@/utils/completionCalculator";
import {
  getProjectSchema,
  getExperimentSchema,
  getDatasetSchema
} from "@/utils/schemaViews";
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
  handleDownload: () => void;
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
      incompleteItems: 0,
      incompleteItemLabel: "variable",
      enabled: false
    }
  ]);

  const openModal = useCallback(() => {
    const projectSchema = getProjectSchema();
    const experimentSchema = getExperimentSchema();
    const datasetSchema = getDatasetSchema();

    // Check if each section has data
    const hasProjectData = Boolean(projectData?.project_id);
    const hasExperiments = experiments.length > 0;
    const hasDatasets = datasets.length > 0;

    // Calculate missing fields for project
    const projectMissing = hasProjectData
      ? countMissingProjectFields(projectData, projectSchema)
      : 0;

    // Calculate missing fields for experiments (sum all)
    let experimentMissing = 0;
    experiments.forEach((exp) => {
      experimentMissing += countMissingExperimentFields(
        exp.formData,
        experimentSchema
      );
    });

    // Calculate missing fields for datasets (sum all)
    let datasetMissing = 0;
    let incompleteVars = 0;
    datasets.forEach((ds) => {
      datasetMissing += countMissingDatasetFields(ds.formData, datasetSchema);
      incompleteVars += countIncompleteVariables(ds.formData, datasetSchema);
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
        missingFields: projectMissing,
        enabled: getDefaultEnabled("project", hasProjectData),
        disabled: !hasProjectData,
        disabledReason: !hasProjectData ? "No project data" : undefined
      },
      {
        key: "experiment",
        label: "Experiments",
        missingFields: experimentMissing,
        enabled: getDefaultEnabled("experiment", hasExperiments),
        disabled: !hasExperiments,
        disabledReason: !hasExperiments ? "No experiments created" : undefined
      },
      {
        key: "dataset",
        label: "Datasets",
        missingFields: datasetMissing,
        incompleteItems: incompleteVars,
        incompleteItemLabel: "variable",
        enabled: getDefaultEnabled("dataset", hasDatasets),
        disabled: !hasDatasets,
        disabledReason: !hasDatasets ? "No datasets created" : undefined
      }
    ]);

    setShowModal(true);
  }, [projectData, experiments, datasets, defaultSelection]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleDownload = useCallback(() => {
    exportMetadata(projectData, experiments, datasets);
    setShowModal(false);
  }, [projectData, experiments, datasets]);

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
