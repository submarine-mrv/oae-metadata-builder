import React from "react";
import { Modal, Alert, Button, Group } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

interface DownloadConfirmationModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  metadataType: "project" | "experiment" | "dataset";
  title: string;
}

export default function DownloadConfirmationModal({
  opened,
  onClose,
  onConfirm,
  metadataType,
  title
}: DownloadConfirmationModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
    >
      <Alert
        icon={<IconAlertTriangle size={20} />}
        title="Partial Download"
        color="yellow"
        variant="light"
        mb="md"
      >
        This will only download {metadataType}-level metadata. To download all
        metadata, return to the main page and click the &quot;Export Metadata&quot; button in the upper right corner.
      </Alert>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="filled" onClick={onConfirm}>
          Continue
        </Button>
      </Group>
    </Modal>
  );
}
