import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { type LocalProjectSource, readLocalProjectSources } from "../storage";
import { projectSyncActionsAtom } from "../syncState";

/** Mounted only after the owner's cloud load; no guest data enters Jotai before consent. */
export default function LocalProjectMigration() {
  const sync = useAtomValue(projectSyncActionsAtom);
  const [projects, setProjects] = useState<LocalProjectSource[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setProjects(readLocalProjectSources());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read local projects.");
    }
  }, []);

  const finish = async (migrate: boolean) => {
    if (!sync || busy || !projects) return;
    setBusy(true);
    setError(null);
    try {
      if (migrate) {
        await sync.migrateLocalProjects();
      } else {
        // Use the same unchanged-source check as migration; never clear another tab's edits.
        for (const source of projects) source.remove();
      }
      setProjects([]);
      notifications.show({
        title: migrate ? "Local projects imported" : "Local projects cleared",
        message: migrate
          ? "Your projects are now in your account."
          : "The local project copies were removed from this browser.",
        color: migrate ? "green" : "gray",
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not process local projects.";
      setError(message);
      notifications.show({ title: "Local projects", message, color: "red" });
      try {
        setProjects(readLocalProjectSources());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read local projects.");
      }
    } finally {
      setBusy(false);
    }
  };

  const count = projects?.length ?? 0;
  const one = count === 1;
  return (
    <Modal
      opened={Boolean(projects?.length || error)}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title="Import local projects?"
      centered
    >
      <Stack>
        <Text>
          {one
            ? "This browser has 1 project from before you signed in. Import it into your account to keep it."
            : `This browser has ${count} projects from before you signed in. Import them into your account to keep them.`}
        </Text>
        <Text c="dimmed">
          {one
            ? "If you don't import it, it's deleted from this browser."
            : "If you don't import them, they're deleted from this browser."}{" "}
          Projects already in your account don't change.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          {error && (
            <Button
              variant="subtle"
              disabled={busy}
              onClick={() => {
                setProjects([]);
                setError(null);
              }}
            >
              Keep local copies and continue
            </Button>
          )}
          <Button variant="default" disabled={busy} onClick={() => void finish(false)}>
            Clear without importing
          </Button>
          <Button loading={busy} onClick={() => void finish(true)}>
            Import local projects
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
