import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useImportPreview } from "../useImportPreview";
import type {
  ProjectFormData,
  ExperimentFormData,
  DatasetFormData,
  ExperimentState,
  DatasetState
} from "@/types/forms";

// Helper to create test experiments
function createExperiment(
  id: number,
  experimentId: string,
  name: string
): ExperimentState {
  return {
    id,
    name,
    formData: { experiment_id: experimentId, project_id: "PROJ-001" },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// Helper to create test datasets
function createDataset(id: number, name: string): DatasetState {
  return {
    id,
    name,
    formData: { name, project_id: "PROJ-001" },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

describe("useImportPreview", () => {
  describe("duplicate experiment_id validation", () => {
    it("sets error when import file has duplicate experiment_ids", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            { name: "Experiment 1", experiment_id: "EXP-001" } as ExperimentFormData,
            { name: "Experiment 2", experiment_id: "EXP-001" } as ExperimentFormData // duplicate
          ],
          []
        );
      });

      expect(result.current.state.duplicateExperimentIdError).toContain("EXP-001");
    });

    it("does not set error when experiment_ids are unique", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            { name: "Experiment 1", experiment_id: "EXP-001" } as ExperimentFormData,
            { name: "Experiment 2", experiment_id: "EXP-002" } as ExperimentFormData
          ],
          []
        );
      });

      expect(result.current.state.duplicateExperimentIdError).toBeNull();
    });

    it("ignores empty experiment_ids when checking for duplicates", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            { name: "Experiment 1", experiment_id: "" } as ExperimentFormData,
            { name: "Experiment 2", experiment_id: "" } as ExperimentFormData // both empty - should be ok
          ],
          []
        );
      });

      expect(result.current.state.duplicateExperimentIdError).toBeNull();
    });
  });

  describe("experiment linking resolution", () => {
    it("resolves to existing experiment when experiment_id matches", () => {
      const currentExperiments = [
        createExperiment(1, "EXP-001", "Existing Experiment 1"),
        createExperiment(2, "EXP-002", "Existing Experiment 2")
      ];

      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments,
          currentDatasets: []
        })
      );

      // Import a dataset with experiment_id matching existing experiment
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-001" } as DatasetFormData]
        );
      });

      const datasetItem = result.current.state.items.find(
        (i) => i.type === "dataset"
      );
      expect(datasetItem?.experimentLinking?.mode).toBe("use-file");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe(
        "existing"
      );
      expect(
        datasetItem?.experimentLinking?.resolvedMatch?.experimentName
      ).toBe("Existing Experiment 1");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.internalId).toBe(1);
    });

    it("resolves to importing experiment when experiment_id matches importing experiment", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      // Import both an experiment and a dataset that references it
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            {
              name: "New Experiment",
              experiment_id: "EXP-NEW"
            } as ExperimentFormData
          ],
          [
            { name: "Dataset 1", experiment_id: "EXP-NEW" } as DatasetFormData
          ]
        );
      });

      const datasetItem = result.current.state.items.find(
        (i) => i.type === "dataset"
      );
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe(
        "importing"
      );
      expect(
        datasetItem?.experimentLinking?.resolvedMatch?.experimentName
      ).toBe("New Experiment");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.importKey).toBe(
        "experiment-0"
      );
    });

    it("resolves to none when experiment_id has no match", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      // Import a dataset with experiment_id that doesn't match anything
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [
            {
              name: "Dataset 1",
              experiment_id: "EXP-NONEXISTENT"
            } as DatasetFormData
          ]
        );
      });

      const datasetItem = result.current.state.items.find(
        (i) => i.type === "dataset"
      );
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("none");
    });

    it("resolves to none when no experiment_id in file", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      // Import a dataset without experiment_id
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1" } as DatasetFormData]
        );
      });

      const datasetItem = result.current.state.items.find(
        (i) => i.type === "dataset"
      );
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("none");
    });
  });

  describe("setDatasetExperimentLinking", () => {
    it("switches dataset to explicit linking with existing experiment", () => {
      const currentExperiments = [
        createExperiment(1, "EXP-001", "Existing Experiment 1")
      ];

      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments,
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1" } as DatasetFormData]
        );
      });

      // Switch to explicit linking
      act(() => {
        result.current.setDatasetExperimentLinking(
          "dataset-0",
          "explicit",
          1, // internal ID of existing experiment
          undefined
        );
      });

      const datasetItem = result.current.state.items.find(
        (i) => i.type === "dataset"
      );
      expect(datasetItem?.experimentLinking?.mode).toBe("explicit");
      expect(
        datasetItem?.experimentLinking?.explicitExperimentInternalId
      ).toBe(1);
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe(
        "existing"
      );
      expect(
        datasetItem?.experimentLinking?.resolvedMatch?.experimentName
      ).toBe("Existing Experiment 1");
    });

    it("switches dataset to explicit linking with importing experiment", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            {
              name: "New Experiment",
              experiment_id: "EXP-NEW"
            } as ExperimentFormData
          ],
          [{ name: "Dataset 1" } as DatasetFormData]
        );
      });

      // Switch to explicit linking with importing experiment
      act(() => {
        result.current.setDatasetExperimentLinking(
          "dataset-0",
          "explicit",
          undefined,
          "experiment-0" // import key of importing experiment
        );
      });

      const datasetItem = result.current.state.items.find(
        (i) => i.type === "dataset"
      );
      expect(datasetItem?.experimentLinking?.mode).toBe("explicit");
      expect(datasetItem?.experimentLinking?.explicitImportKey).toBe(
        "experiment-0"
      );
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe(
        "importing"
      );
    });

    it("switches back to use-file mode", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [
            createExperiment(1, "EXP-001", "Existing Experiment")
          ],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [
            { name: "Dataset 1", experiment_id: "EXP-001" } as DatasetFormData
          ]
        );
      });

      // First switch to explicit
      act(() => {
        result.current.setDatasetExperimentLinking(
          "dataset-0",
          "explicit",
          1,
          undefined
        );
      });

      // Then switch back to use-file
      act(() => {
        result.current.setDatasetExperimentLinking("dataset-0", "use-file");
      });

      const datasetItem = result.current.state.items.find(
        (i) => i.type === "dataset"
      );
      expect(datasetItem?.experimentLinking?.mode).toBe("use-file");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe(
        "existing"
      );
    });
  });

  describe("getExperimentLinkOptions", () => {
    it("shows file experiment_id as first option for a dataset", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-123" } as DatasetFormData]
        );
      });

      const options = result.current.getExperimentLinkOptions("dataset-0");
      expect(options[0].value).toBe("use-file");
      // When no match, should show raw experiment_id
      expect(options[0].label).toBe("EXP-123");
    });

    it("shows matched experiment name for file experiment_id option", () => {
      const currentExperiments = [
        createExperiment(1, "EXP-001", "Experiment One"),
        createExperiment(2, "EXP-002", "Experiment Two")
      ];

      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments,
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-001" } as DatasetFormData]
        );
      });

      const options = result.current.getExperimentLinkOptions("dataset-0");
      expect(options[0].value).toBe("use-file");
      // Should show experiment name since it matches
      expect(options[0].label).toBe("Experiment One (EXP-001)");
      // Other experiments should be in remaining options
      expect(options[1].value).toBe("existing-2");
      expect(options[1].label).toContain("Experiment Two");
    });

    it("shows '(no experiment)' when dataset has no experiment_id", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1" } as DatasetFormData]
        );
      });

      const options = result.current.getExperimentLinkOptions("dataset-0");
      expect(options[0].value).toBe("use-file");
      expect(options[0].label).toBe("(no experiment)");
    });

    it("includes importing experiments when they are selected", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            {
              name: "Importing Experiment",
              experiment_id: "EXP-IMP"
            } as ExperimentFormData
          ],
          [{ name: "Dataset 1" } as DatasetFormData]
        );
      });

      const options = result.current.getExperimentLinkOptions("dataset-0");
      // First option is use-file, second should be the importing experiment
      const importingOption = options.find(
        (o) => o.value === "importing-experiment-0"
      );
      expect(importingOption).toBeDefined();
      expect(importingOption?.label).toBe("Importing Experiment (EXP-IMP)");
    });
  });

  describe("getSelectedItems", () => {
    it("returns datasets with their linking configuration", () => {
      const { result } = renderHook(() =>
        useImportPreview({
          currentProjectData: { project_id: "PROJ-001" },
          currentExperiments: [
            createExperiment(1, "EXP-001", "Existing Experiment")
          ],
          currentDatasets: []
        })
      );

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [
            { name: "Dataset 1", experiment_id: "EXP-001" } as DatasetFormData
          ]
        );
      });

      const selected = result.current.getSelectedItems();
      expect(selected.datasets).toHaveLength(1);
      expect(selected.datasets[0].formData.name).toBe("Dataset 1");
      expect(selected.datasets[0].experimentLinking?.mode).toBe("use-file");
      expect(selected.datasets[0].experimentLinking?.resolvedMatch?.type).toBe(
        "existing"
      );
    });
  });
});
