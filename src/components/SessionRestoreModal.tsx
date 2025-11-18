import React from "react";
import { Modal, Alert, Button, Group, Text, List } from "@mantine/core";
import { IconRestore } from "@tabler/icons-react";

interface SessionRestoreModalProps {
  opened: boolean;
  onRestore: () => void;
  onStartFresh: () => void;
  projectName: string;
  experimentNames: string[];
  savedAt: Date;
}

export default function SessionRestoreModal({
  opened,
  onRestore,
  onStartFresh,
  projectName,
  experimentNames,
  savedAt
}: SessionRestoreModalProps) {
  const formattedDate = savedAt.toLocaleString();

  return (
    <Modal
      opened={opened}
      onClose={onStartFresh}
      title="Restore Previous Session?"
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Alert
        icon={<IconRestore size={20} />}
        title="Session Found"
        color="blue"
        variant="light"
        mb="md"
      >
        We found a previous session saved at {formattedDate}.
      </Alert>

      <Text size="sm" fw={500} mb="xs">
        Project:
      </Text>
      <Text size="sm" mb="md" c="dimmed">
        {projectName || "(Untitled Project)"}
      </Text>

      {experimentNames.length > 0 && (
        <>
          <Text size="sm" fw={500} mb="xs">
            Experiments:
          </Text>
          <List size="sm" mb="md" spacing="xs">
            {experimentNames.map((name, index) => (
              <List.Item key={index}>{name}</List.Item>
            ))}
          </List>
        </>
      )}

      <Group justify="flex-end" gap="sm" mt="lg">
        <Button variant="default" onClick={onStartFresh}>
          Start Fresh
        </Button>
        <Button variant="filled" onClick={onRestore}>
          Restore Session
        </Button>
      </Group>
    </Modal>
  );
}
