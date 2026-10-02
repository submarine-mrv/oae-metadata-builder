import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { ProjectSummary } from "@/workspace/WorkspaceContext";

interface DeleteProjectModalProps {
  /** The project up for deletion; null closes the modal. */
  project: ProjectSummary | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteProjectModal({
  project,
  onConfirm,
  onCancel,
}: DeleteProjectModalProps) {
  return (
    <Modal opened={project !== null} onClose={onCancel} title="Delete project">
      {project && (
        <Stack>
          <Text size="sm">
            Delete <strong>{project.name}</strong> and its {project.experimentCount} experiment
            {project.experimentCount === 1 ? "" : "s"} and {project.datasetCount} dataset
            {project.datasetCount === 1 ? "" : "s"}? This cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
            <Button color="red" onClick={onConfirm}>
              Delete project
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
