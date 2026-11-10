import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtomValue, useStore } from "jotai";
import { useState } from "react";
import { workspaceAtom } from "@/state/atoms";
import { projectSyncActionsAtom } from "../syncState";
import { projectDisplayName } from "../types";

/** Lets the user settle clashing fields with this tab's values or the newer ones. */
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
        message: keep
          ? "Yours replaced the newer version where you both edited."
          : "Your other edits were kept.",
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
          Where you both edited the same thing in{" "}
          {project ? `"${projectDisplayName(project.state)}"` : "this project"}, choose whose
          version to keep. Everything else either of you changed is kept.
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
