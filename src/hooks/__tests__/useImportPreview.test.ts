import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DatasetRecord, DraftDataset, DraftExperiment, ExperimentRecord } from "@/types/forms";
import { applyImport } from "@/utils/applyImport";
import { emptyProjectState } from "@/workspace/types";
import { EMPTY_BASELINE, useImportPreview } from "../useImportPreview";

// Helper to create test experiments
function createExperiment(id: number, experimentId: string, name: string): ExperimentRecord {
  return {
    id,
    name,
    formData: { experiment_id: experimentId, project_id: "PROJ-001" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Helper to create test datasets
function _createDataset(id: number, name: string): DatasetRecord {
  return {
    id,
    name,
    formData: { name, project_id: "PROJ-001" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("useImportPreview", () => {
  describe("duplicate experiment_id validation", () => {
    it("sets error when import file has duplicate experiment_ids", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            { name: "Experiment 1", experiment_id: "EXP-001" } as DraftExperiment,
            { name: "Experiment 2", experiment_id: "EXP-001" } as DraftExperiment, // duplicate
          ],
          [],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      expect(result.current.state.duplicateExperimentIdError).toContain("EXP-001");
    });

    it("does not set error when experiment_ids are unique", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            { name: "Experiment 1", experiment_id: "EXP-001" } as DraftExperiment,
            { name: "Experiment 2", experiment_id: "EXP-002" } as DraftExperiment,
          ],
          [],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      expect(result.current.state.duplicateExperimentIdError).toBeNull();
    });

    it("ignores empty experiment_ids when checking for duplicates", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            { name: "Experiment 1", experiment_id: "" } as DraftExperiment,
            { name: "Experiment 2", experiment_id: "" } as DraftExperiment, // both empty - should be ok
          ],
          [],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      expect(result.current.state.duplicateExperimentIdError).toBeNull();
    });
  });

  describe("experiment linking resolution", () => {
    it("resolves to existing experiment when experiment_id matches", () => {
      const currentExperiments = [
        createExperiment(1, "EXP-001", "Existing Experiment 1"),
        createExperiment(2, "EXP-002", "Existing Experiment 2"),
      ];

      const { result } = renderHook(() => useImportPreview());

      // Import a dataset with experiment_id matching existing experiment
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-001" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: currentExperiments },
        );
      });

      const datasetItem = result.current.state.items.find((i) => i.type === "dataset");
      expect(datasetItem?.experimentLinking?.mode).toBe("use-file");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("existing");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.experimentName).toBe(
        "Existing Experiment 1",
      );
      expect(datasetItem?.experimentLinking?.resolvedMatch?.internalId).toBe(1);
    });

    it("resolves to importing experiment when experiment_id matches importing experiment", () => {
      const { result } = renderHook(() => useImportPreview());

      // Import both an experiment and a dataset that references it
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            {
              name: "New Experiment",
              experiment_id: "EXP-NEW",
            } as DraftExperiment,
          ],
          [{ name: "Dataset 1", experiment_id: "EXP-NEW" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      const datasetItem = result.current.state.items.find((i) => i.type === "dataset");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("importing");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.experimentName).toBe("New Experiment");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.importKey).toBe("experiment-0");
    });

    it("resolves to none when experiment_id has no match", () => {
      const { result } = renderHook(() => useImportPreview());

      // Import a dataset with experiment_id that doesn't match anything
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [
            {
              name: "Dataset 1",
              experiment_id: "EXP-NONEXISTENT",
            } as DraftDataset,
          ],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      const datasetItem = result.current.state.items.find((i) => i.type === "dataset");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("none");
    });

    it("resolves to none when no experiment_id in file", () => {
      const { result } = renderHook(() => useImportPreview());

      // Import a dataset without experiment_id
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      const datasetItem = result.current.state.items.find((i) => i.type === "dataset");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("none");
    });
  });

  describe("setDatasetExperimentLinking", () => {
    it("switches dataset to explicit linking with existing experiment", () => {
      const currentExperiments = [createExperiment(1, "EXP-001", "Existing Experiment 1")];

      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: currentExperiments },
        );
      });

      // Switch to explicit linking
      act(() => {
        result.current.setDatasetExperimentLinking(
          "dataset-0",
          "explicit",
          1, // internal ID of existing experiment
          undefined,
        );
      });

      const datasetItem = result.current.state.items.find((i) => i.type === "dataset");
      expect(datasetItem?.experimentLinking?.mode).toBe("explicit");
      expect(datasetItem?.experimentLinking?.explicitExperimentInternalId).toBe(1);
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("existing");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.experimentName).toBe(
        "Existing Experiment 1",
      );
    });

    it("switches dataset to explicit linking with importing experiment", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            {
              name: "New Experiment",
              experiment_id: "EXP-NEW",
            } as DraftExperiment,
          ],
          [{ name: "Dataset 1" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      // Switch to explicit linking with importing experiment
      act(() => {
        result.current.setDatasetExperimentLinking(
          "dataset-0",
          "explicit",
          undefined,
          "experiment-0", // import key of importing experiment
        );
      });

      const datasetItem = result.current.state.items.find((i) => i.type === "dataset");
      expect(datasetItem?.experimentLinking?.mode).toBe("explicit");
      expect(datasetItem?.experimentLinking?.explicitImportKey).toBe("experiment-0");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("importing");
    });

    it("switches back to use-file mode", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-001" } as DraftDataset],
          {
            projectData: { project_id: "PROJ-001" },
            experiments: [createExperiment(1, "EXP-001", "Existing Experiment")],
          },
        );
      });

      // First switch to explicit
      act(() => {
        result.current.setDatasetExperimentLinking("dataset-0", "explicit", 1, undefined);
      });

      // Then switch back to use-file
      act(() => {
        result.current.setDatasetExperimentLinking("dataset-0", "use-file");
      });

      const datasetItem = result.current.state.items.find((i) => i.type === "dataset");
      expect(datasetItem?.experimentLinking?.mode).toBe("use-file");
      expect(datasetItem?.experimentLinking?.resolvedMatch?.type).toBe("existing");
    });
  });

  describe("getExperimentLinkOptions", () => {
    it("shows file experiment_id as first option for a dataset", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-123" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
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
        createExperiment(2, "EXP-002", "Experiment Two"),
      ];

      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-001" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: currentExperiments },
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
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      const options = result.current.getExperimentLinkOptions("dataset-0");
      expect(options[0].value).toBe("use-file");
      expect(options[0].label).toBe("(no experiment)");
    });

    it("includes importing experiments when they are selected", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [
            {
              name: "Importing Experiment",
              experiment_id: "EXP-IMP",
            } as DraftExperiment,
          ],
          [{ name: "Dataset 1" } as DraftDataset],
          { projectData: { project_id: "PROJ-001" }, experiments: [] },
        );
      });

      const options = result.current.getExperimentLinkOptions("dataset-0");
      // First option is use-file, second should be the importing experiment
      const importingOption = options.find((o) => o.value === "importing-experiment-0");
      expect(importingOption).toBeDefined();
      expect(importingOption?.label).toBe("Importing Experiment (EXP-IMP)");
    });
  });

  describe("getSelectedItems", () => {
    it("returns datasets with their linking configuration", () => {
      const { result } = renderHook(() => useImportPreview());

      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [],
          [{ name: "Dataset 1", experiment_id: "EXP-001" } as DraftDataset],
          {
            projectData: { project_id: "PROJ-001" },
            experiments: [createExperiment(1, "EXP-001", "Existing Experiment")],
          },
        );
      });

      const selected = result.current.getSelectedItems();
      expect(selected.datasets).toHaveLength(1);
      expect(selected.datasets[0].formData.name).toBe("Dataset 1");
      expect(selected.datasets[0].experimentLinking?.mode).toBe("use-file");
      expect(selected.datasets[0].experimentLinking?.resolvedMatch?.type).toBe("existing");
    });

    const threeExperiments = [
      { experiment_id: "E0", name: "Zero" },
      { experiment_id: "E1", name: "One" },
      { experiment_id: "E2", name: "Two" },
    ] as DraftExperiment[];

    it("keeps a dataset linked to its experiment when an earlier one is deselected", () => {
      const { result } = renderHook(() => useImportPreview());
      act(() => {
        result.current.openPreview(
          "test.json",
          {},
          threeExperiments,
          [{ name: "DS", experiment_id: "E1" } as DraftDataset],
          EMPTY_BASELINE,
        );
      });
      act(() => result.current.toggleItem("experiment-0"));

      const applied = applyImport(emptyProjectState(), result.current.getSelectedItems());
      const e1 = applied.experiments.find((e) => e.formData.experiment_id === "E1");
      expect(applied.experiments).toHaveLength(2);
      expect(applied.datasets[0].linking?.linkedExperimentInternalId).toBe(e1?.id);
      expect(applied.datasets[0].formData.experiment_id).toBe("E1");
    });

    it("remaps an explicit link to an importing experiment", () => {
      const { result } = renderHook(() => useImportPreview());
      act(() => {
        result.current.openPreview(
          "test.json",
          {},
          threeExperiments,
          [{ name: "DS" } as DraftDataset],
          EMPTY_BASELINE,
        );
      });
      act(() =>
        result.current.setDatasetExperimentLinking(
          "dataset-0",
          "explicit",
          undefined,
          "experiment-2",
        ),
      );
      act(() => result.current.toggleItem("experiment-0"));

      const applied = applyImport(emptyProjectState(), result.current.getSelectedItems());
      expect(applied.datasets[0].formData.experiment_id).toBe("E2");
    });

    it("drops the link to a deselected experiment", () => {
      const { result } = renderHook(() => useImportPreview());
      act(() => {
        result.current.openPreview(
          "test.json",
          {},
          threeExperiments,
          [{ name: "DS", experiment_id: "E1" } as DraftDataset],
          EMPTY_BASELINE,
        );
      });
      act(() => result.current.toggleItem("experiment-1"));

      const selected = result.current.getSelectedItems();
      expect(selected.datasets[0].experimentLinking).toBeUndefined();
      const applied = applyImport(emptyProjectState(), selected);
      expect(applied.datasets[0].linking?.linkedExperimentInternalId).toBeNull();
      expect(applied.datasets[0].formData.experiment_id).toBe("E1");
    });
  });

  describe("rebase", () => {
    const current = {
      projectData: { project_id: "PROJ-001" },
      experiments: [createExperiment(1, "EXP-001", "Existing Experiment")],
    };

    function openWithEmptyBaseline() {
      const { result } = renderHook(() => useImportPreview());
      act(() => {
        result.current.openPreview(
          "test.json",
          { project_id: "PROJ-001" },
          [{ name: "Imported Experiment", experiment_id: "EXP-001" } as DraftExperiment],
          [{ name: "Dataset 1", experiment_id: "EXP-001" } as DraftDataset],
          EMPTY_BASELINE,
        );
      });
      return result;
    }

    it("re-resolves links and conflicts against the new baseline and back", () => {
      const result = openWithEmptyBaseline();
      const item = (key: string) => result.current.state.items.find((i) => i.key === key);

      expect(item("dataset-0")?.experimentLinking?.resolvedMatch?.type).toBe("importing");
      expect(item("experiment-0")?.conflict).toBe("add-new");

      act(() => result.current.rebase(current));
      expect(item("dataset-0")?.experimentLinking?.resolvedMatch?.type).toBe("existing");
      expect(item("dataset-0")?.experimentLinking?.resolvedMatch?.internalId).toBe(1);
      expect(item("experiment-0")?.conflict).toBe("override");
      expect(item("project-0")?.conflict).toBe("override");

      act(() => result.current.rebase(EMPTY_BASELINE));
      expect(item("dataset-0")?.experimentLinking?.resolvedMatch?.type).toBe("importing");
      expect(item("experiment-0")?.conflict).toBe("add-new");
      expect(item("project-0")?.conflict).toBe("add-new");
    });

    it("keeps an unticked item unticked", () => {
      const result = openWithEmptyBaseline();
      act(() => result.current.toggleItem("experiment-0"));
      act(() => result.current.rebase(current));

      const selected = result.current.state.items.filter((i) => i.selected).map((i) => i.key);
      expect(selected).toEqual(["project-0", "dataset-0"]);
    });
  });
});
