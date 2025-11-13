import { useState } from "react";

export interface UseMetadataDownloadOptions {
  filename: string;
  skipDownload?: boolean;
  onSkipDownloadChange?: (value: boolean) => void;
}

export interface UseMetadataDownloadReturn {
  showDownloadModal: boolean;
  pendingDownloadData: any;
  handleFormSubmit: ({ formData }: any) => void;
  handleDownloadConfirm: () => void;
  handleDownloadCancel: () => void;
}

// Helper function to clean empty spatial_coverage objects
function cleanEmptySpatialCoverage(data: any): any {
  if (!data || typeof data !== "object") return data;

  const cleaned = { ...data };

  // Check if spatial_coverage exists and is an empty object or has no valid box
  if (cleaned.spatial_coverage) {
    const sc = cleaned.spatial_coverage;
    const hasNoBox = !sc.geo || !sc.geo.box || sc.geo.box.trim() === "";
    const isEmpty = Object.keys(sc).length === 0;

    if (isEmpty || hasNoBox) {
      // Remove the spatial_coverage field entirely
      delete cleaned.spatial_coverage;
    }
  }

  return cleaned;
}

export function useMetadataDownload({
  filename,
  skipDownload = false,
  onSkipDownloadChange
}: UseMetadataDownloadOptions): UseMetadataDownloadReturn {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [pendingDownloadData, setPendingDownloadData] = useState<any>(null);

  const downloadJsonFile = (data: any) => {
    // Clean empty spatial_coverage before download
    const cleanedData = cleanEmptySpatialCoverage(data);

    const jsonString = JSON.stringify(cleanedData, null, 2);
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

  const handleFormSubmit = ({ formData }: any) => {
    // Don't show modal if this submit was triggered just to show validation errors
    if (skipDownload) {
      onSkipDownloadChange?.(false);
      return;
    }

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
