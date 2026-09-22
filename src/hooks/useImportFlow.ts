import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { useAppState } from "@/contexts/AppStateContext";
import { EMPTY_BASELINE, type ImportBaseline, useImportPreview } from "@/hooks/useImportPreview";
import { trackEvent } from "@/utils/analytics";
import { importMetadata } from "@/utils/exportImport";
import { projectDisplayName } from "@/workspace/types";
import { useWorkspace } from "@/workspace/WorkspaceContext";

export type ImportMode = "new" | "merge";

/**
 * File picker → preview → confirm. Shared by the header and the welcome screen.
 * Render the returned `inputProps` and `previewProps` through `ImportFlow`.
 */
export function useImportFlow() {
  const { state, importSelectedData } = useAppState();
  const { projects, importAsNewProject } = useWorkspace();
  const navigate = useNavigate();
  const canMerge = projects.length > 0;
  const [mode, setMode] = useState<ImportMode>("new");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveMode: ImportMode = canMerge ? mode : "new";

  const preview = useImportPreview();

  // A new project starts empty, so nothing in the file can clash with or link to the current one.
  const baselineFor = (m: ImportMode): ImportBaseline =>
    m === "merge"
      ? { projectData: state.projectData, experiments: state.experiments }
      : EMPTY_BASELINE;

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
      navigate({ to: "/overview" });
    } else {
      importSelectedData(selected.project, selected.experiments, selected.datasets);
    }
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
      currentProjectName: projectDisplayName(state),
    },
  };
}

export type ImportFlowHandle = ReturnType<typeof useImportFlow>;
