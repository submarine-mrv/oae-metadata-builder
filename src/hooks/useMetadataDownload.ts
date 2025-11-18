import { useState } from "react";
import { ProjectFormData, ExperimentFormData } from "@/types/forms";

export interface UseMetadataDownloadOptions {
  filename: string;
  skipDownload?: boolean;
  onSkipDownloadChange?: (value: boolean) => void;
}

export interface UseMetadataDownloadReturn {
  showDownloadModal: boolean;
  pendingDownloadData: ProjectFormData | ExperimentFormData | null;
  handleFormSubmit: ({ formData }: { formData?: ProjectFormData | ExperimentFormData }) => void;
  handleDownloadConfirm: () => void;
  handleDownloadCancel: () => void;
}

export function useMetadataDownload({
  filename,
  skipDownload = false,
  onSkipDownloadChange
}: UseMetadataDownloadOptions): UseMetadataDownloadReturn {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [pendingDownloadData, setPendingDownloadData] = useState<ProjectFormData | ExperimentFormData | null>(null);

  const downloadJsonFile = (data: ProjectFormData | ExperimentFormData) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFormSubmit = ({ formData }: { formData?: ProjectFormData | ExperimentFormData }) => {
    // Don't show modal if this submit was triggered just to show validation errors
    if (skipDownload) {
      onSkipDownloadChange?.(false);
      return;
    }

    if (!formData) return;

    // Form is valid - show confirmation modal
    setPendingDownloadData(formData);
    setShowDownloadModal(true);
  };

  const handleDownloadConfirm = () => {
    setShowDownloadModal(false);
    if (pendingDownloadData) {
      downloadJsonFile(pendingDownloadData);
      setPendingDownloadData(null);
    }
  };

  const handleDownloadCancel = () => {
    setShowDownloadModal(false);
    setPendingDownloadData(null);
  };

  return {
    showDownloadModal,
    pendingDownloadData,
    handleFormSubmit,
    handleDownloadConfirm,
    handleDownloadCancel
  };
}
