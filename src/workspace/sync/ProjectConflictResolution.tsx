import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtomValue, useStore } from "jotai";
import { useState } from "react";
import { workspaceAtom } from "@/state/atoms";
import { projectSyncActionsAtom } from "../syncState";
import { projectDisplayName } from "../types";

/** Lets the user settle a conflict by keeping this tab's version or taking the other one. */
export default function ProjectConflictResolution({
  projectId,
  message,
  onClose,
}: {
  projectId: string;
  message: string;
  onClose(): void;
}) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const project = useAtomValue(workspaceAtom).projects.find((record) => record.id === projectId);

  const resolve = async (keep: boolean) => {
    const sync = store.get(projectSyncActionsAtom);
    if (!sync || busy) return;
    setBusy(true);
    setError(null);
    try {
      await (keep ? sync.keepProjectChanges(projectId) : sync.discardProjectChanges(projectId));
      onClose();
      notifications.show({
        title: keep ? "Kept your version" : "Switched to the other version",
        message: keep
          ? "Your version replaced the one saved elsewhere."
          : "Your unsaved changes to this project were dropped.",
        color: "green",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resolve the conflict.");
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
      title="Resolve conflicting changes"
    >
      <Stack>
        <Text>{message}</Text>
        <Text size="sm" c="dimmed">
          Keep mine replaces the version saved elsewhere. Use the other version drops your unsaved
          changes to {project ? `"${projectDisplayName(project.state)}"` : "this project"}.{" "}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" loading={busy} onClick={() => void resolve(false)}>
            Use the other version
          </Button>
          <Button disabled={busy || !project} onClick={() => void resolve(true)}>
            Keep mine
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
