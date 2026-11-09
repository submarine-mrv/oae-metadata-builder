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
        title: keep ? "Kept your changes" : "Now showing the newer changes",
        message: keep ? "They replaced the newer changes." : "Your unsaved changes were dropped.",
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
      title="Your changes conflict with newer ones"
    >
      <Stack>
        <Text>{message}</Text>
        <Text size="sm" c="dimmed">
          Keep my changes and they replace the newer ones. Use newer changes and yours to{" "}
          {project ? `"${projectDisplayName(project.state)}"` : "this project"} are dropped.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" loading={busy} onClick={() => void resolve(false)}>
            Use newer changes
          </Button>
          <Button disabled={busy || !project} onClick={() => void resolve(true)}>
            Keep my changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
