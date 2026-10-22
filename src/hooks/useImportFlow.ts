import { useNavigate } from "@tanstack/react-router";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { EMPTY_BASELINE, type ImportBaseline, useImportPreview } from "@/hooks/useImportPreview";
import { importAsNewProjectAtom, importSelectedDataAtom } from "@/state/actions";
import { projectCountAtom, projectNameAtom, projectStateAtom } from "@/state/atoms";
import { trackEvent } from "@/utils/analytics";
import { importMetadata } from "@/utils/exportImport";

export type ImportMode = "new" | "merge";

/**
 * File picker → preview → confirm. Shared by the header and the welcome screen.
 * Render the returned `inputProps` and `previewProps` through `ImportFlow`.
 */
export function useImportFlow() {
  const store = useStore();
  const importSelectedData = useSetAtom(importSelectedDataAtom);
  const importAsNewProject = useSetAtom(importAsNewProjectAtom);
  const currentProjectName = useAtomValue(projectNameAtom);
  const navigate = useNavigate();
  const canMerge = useAtomValue(projectCountAtom) > 0;
  const [mode, setMode] = useState<ImportMode>("new");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveMode: ImportMode = canMerge ? mode : "new";

  const preview = useImportPreview();

  // A new project starts empty, so nothing in the file can clash with or link to the current one.
  const baselineFor = (m: ImportMode): ImportBaseline => {
    if (m !== "merge") return EMPTY_BASELINE;
    const { projectData, experiments } = store.get(projectStateAtom);
    return { projectData, experiments };
  };

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { projectData, experiments, datasets } = await importMetadata(file);
      preview.openPreview(
        file.name,
        projectData,
        experiments.map((exp) => exp.formData),
        datasets.map((ds) => ds.formData),
        baselineFor(effectiveMode),
      );
      e.target.value = "";
    } catch (error) {
      console.error("Import failed:", error);
      alert(
        `Failed to import metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const onImport = () => {
    if (preview.state.duplicateExperimentIdError !== null) return;
    const selected = preview.getSelectedItems();
    if (effectiveMode === "new") {
      importAsNewProject(selected);
    } else {
      importSelectedData(selected);
    }
    // Entity pages hold local form data that a merge would leave stale.
    navigate({ to: "/overview" });
    // On confirm, not on file selection: the preview can still be cancelled.
    trackEvent("metadata_import", {
      project: selected.project ? 1 : 0,
      experiments: selected.experiments.length,
      datasets: selected.datasets.length,
      mode: effectiveMode,
    });
    preview.closePreview();
  };

  return {
    openFilePicker,
    inputProps: { ref: fileInputRef, onChange },
    previewProps: {
      opened: preview.state.isOpen,
      onClose: preview.closePreview,
      filename: preview.state.filename,
      items: preview.state.items,
      onToggleItem: preview.toggleItem,
      onSetDatasetLinking: preview.setDatasetExperimentLinking,
      getExperimentLinkOptions: preview.getExperimentLinkOptions,
      duplicateExperimentIdError: preview.state.duplicateExperimentIdError,
      onImport,
      importMode: effectiveMode,
      onImportModeChange: (m: ImportMode) => {
        setMode(m);
        preview.rebase(baselineFor(canMerge ? m : "new"));
      },
      canMerge,
      currentProjectName,
    },
  };
}

export type ImportFlowHandle = ReturnType<typeof useImportFlow>;
