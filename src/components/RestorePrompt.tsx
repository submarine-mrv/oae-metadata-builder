import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/utils/relativeTime";
import { useWorkspace } from "@/workspace/WorkspaceContext";

/** Set once a tab has been asked, so reloads in the same tab don't ask again. */
export const RESTORE_PROMPTED_KEY = "oae-metadata-builder-restore-prompted";

function alreadyPrompted(): boolean {
  try {
    return sessionStorage.getItem(RESTORE_PROMPTED_KEY) !== null;
  } catch {
    return false;
  }
}

function markPrompted() {
  try {
    sessionStorage.setItem(RESTORE_PROMPTED_KEY, "1");
  } catch {
    // Storage blocked: the prompt shows again on the next load.
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * On the first load of a tab with saved projects, offers to restore them or start fresh. Starting fresh deletes every project after a confirm step.
 */
export default function RestorePrompt() {
  const { projects, deleteAllProjects } = useWorkspace();
  const [opened, setOpened] = useState(() => projects.length > 0 && !alreadyPrompted());
  const [confirming, setConfirming] = useState(false);

  // A tab that opened with nothing saved has nothing to restore later either.
  useEffect(() => {
    if (!opened) markPrompted();
  }, [opened]);

  if (!opened) return null;

  const close = () => {
    markPrompted();
    setOpened(false);
  };
  const startFresh = () => {
    deleteAllProjects();
    close();
  };

  const experiments = projects.reduce((n, p) => n + p.experimentCount, 0);
  const datasets = projects.reduce((n, p) => n + p.datasetCount, 0);
  const contents = [
    experiments > 0 && plural(experiments, "experiment"),
    datasets > 0 && plural(datasets, "dataset"),
  ].filter(Boolean);
  const lastEdited = Math.max(...projects.map((p) => p.updatedAt));

  return (
    <Modal
      opened
      // Escape backs out of the confirm step; on the first step it restores, the safe choice.
      onClose={confirming ? () => setConfirming(false) : close}
      title={confirming ? "Start fresh?" : "Welcome back"}
      centered
      closeOnClickOutside={false}
      withCloseButton={false}
    >
      {confirming ? (
        <Stack>
          <Text size="sm">
            This removes {plural(projects.length, "project")}
            {contents.length > 0 && `, with ${contents.join(" and ")},`} from this browser. You
            can't undo this.
          </Text>
          <Text size="sm">
            To keep a permanent copy, select Back, restore your session, and export{" "}
            {projects.length === 1 ? "the project" : "each project"} first.
          </Text>
          <Group justify="flex-end">
            {/* Focus the safe choice, so Enter never deletes. */}
            <Button variant="default" onClick={() => setConfirming(false)} autoFocus>
              Back
            </Button>
            <Button color="red" onClick={startFresh}>
              Remove all projects
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Text size="sm">
            You have {plural(projects.length, "project")} saved in this browser, last edited{" "}
            {formatRelativeTime(lastEdited)}. Would you like to restore work from your previous
            session?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirming(true)}>
              Start fresh
            </Button>
            <Button onClick={close} data-autofocus>
              Restore session
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
