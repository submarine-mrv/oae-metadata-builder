import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtomValue, useStore } from "jotai";
import { useState } from "react";
import { workspaceAtom } from "@/state/atoms";
import { exportMetadata } from "@/utils/exportImport";
import { projectSyncActionsAtom } from "../syncState";

export default function ProjectConflictResolution({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose(): void;
}) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const project = useAtomValue(workspaceAtom).projects.find((record) => record.id === projectId);

  const discard = async () => {
    const sync = store.get(projectSyncActionsAtom);
    if (!sync || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sync.discardProjectChanges(projectId);
      onClose();
      notifications.show({
        title: "Local changes discarded",
        message: "This project now matches the cloud, including any remote deletion.",
        color: "green",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not discard local changes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
      title="Resolve project conflict"
    >
      <Stack>
        <Text>
          Export your unsaved project to keep a copy before discarding. Discarding permanently
          replaces this project's local changes with the latest cloud version, or removes it if it
          was deleted remotely. Other projects are not changed.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          {project && (
            <Button
              variant="light"
              disabled={busy}
              onClick={() => {
                const latest = store
                  .get(workspaceAtom)
                  .projects.find((record) => record.id === projectId);
                if (latest)
                  exportMetadata(
                    latest.state.projectData,
                    latest.state.experiments,
                    latest.state.datasets,
                  );
              }}
            >
              Export unsaved project
            </Button>
          )}
          <Button color="red" loading={busy} onClick={() => void discard()}>
            Discard local changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
