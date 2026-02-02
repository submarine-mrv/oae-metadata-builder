import React from "react";
import {
  Modal,
  Alert,
  Button,
  Group,
  Stack,
  Text,
  Badge
} from "@mantine/core";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";

interface SingleItemDownloadModalProps {
  opened: boolean;
  onClose: () => void;
  onDownload: () => void;
  /** Title for the modal (e.g., "Download Dataset Metadata") */
  title: string;
  /** Number of validation errors for this item */
  errorCount: number;
  /**
   * Callback when user clicks "Go Back" button.
   * Should close modal and scroll to validation errors.
   * Falls back to onClose if not provided.
   */
  onGoBack?: () => void;
  /** Callback fired after modal exit transition completes */
  onExitTransitionEnd?: () => void;
}

/**
 * SingleItemDownloadModal - Simplified modal for downloading a single item's metadata.
 * Used on page-level download buttons (Dataset, Experiment, Project pages).
 * Shows validation status and download button.
 */
export default function SingleItemDownloadModal({
  opened,
  onClose,
  onDownload,
  title,
  errorCount,
  onGoBack,
  onExitTransitionEnd
}: SingleItemDownloadModalProps) {
  const hasErrors = errorCount > 0;

  const handleDownload = () => {
    onDownload();
    onClose();
  };

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={onExitTransitionEnd}
      title={title}
      centered
      size="md"
    >
      <Stack gap="md">
        {/* Validation status */}
        {hasErrors ? (
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="yellow"
            variant="light"
            py="sm"
          >
            <Stack gap="xs">
              <Badge color="orange" variant="light" size="sm" w="fit-content">
                {errorCount} validation error{errorCount !== 1 ? "s" : ""}
              </Badge>
              <Text size="sm" c="dark.6">
                Some required fields are missing or incomplete. However, you can
                still download as a draft to save your work in progress.
              </Text>
            </Stack>
          </Alert>
        ) : (
          <Alert
            icon={<IconCheck size={18} />}
            color="green"
            variant="light"
            py="sm"
          >
            <Text size="sm" c="dark.6">
              No validation errors
            </Text>
          </Alert>
        )}

        {/* Action buttons */}
        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="default" onClick={handleGoBack}>
            Go Back
          </Button>
          <Button variant="filled" onClick={handleDownload}>
            {hasErrors ? "Download Anyway" : "Download"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
