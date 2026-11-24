import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Radio,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtomValue, useStore } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { JsonDiffViewer } from "@/components/JsonDiffViewer";
import { workspaceAtom } from "@/state/atoms";
import { type DiffSide, isScalar } from "@/utils/jsonDiff";
import { type ConflictPreference, equalData, type SyncConflict } from "../merge";
import {
  type ConflictChoices,
  ProjectConflictChangedError,
  projectSyncActionsAtom,
} from "../syncState";
import { projectDisplayName } from "../types";

type ViewMode = "text" | "json";

type TextValueProps = { side: DiffSide; heading: string };

function TextValue({ side, heading }: TextValueProps) {
  return (
    <div className="min-w-0">
      <Text size="xs" fw={600} c="dimmed">
        {heading}
      </Text>
      {!side.present ? (
        <Text size="sm" fs="italic" c="dimmed">
          Not present
        </Text>
      ) : side.value === "" ? (
        <Text size="sm" fs="italic" c="dimmed">
          Empty
        </Text>
      ) : (
        <Text size="sm" className="whitespace-pre-wrap break-words">
          {typeof side.value === "string" ? side.value : JSON.stringify(side.value)}
        </Text>
      )}
    </div>
  );
}

type ConflictCardProps = {
  conflict: SyncConflict;
  view: ViewMode;
  choice: ConflictPreference | undefined;
  disabled: boolean;
  onChoose(choice: ConflictPreference): void;
};

function ConflictCard({ conflict, view, choice, disabled, onChoose }: ConflictCardProps) {
  const plainText = view === "text" && isScalar(conflict.local) && isScalar(conflict.remote);
  const name = `${conflict.group}: ${conflict.label}`;
  return (
    <Paper withBorder p="sm" component="section" aria-label={name}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div className="min-w-0">
            <Text size="xs" c="dimmed">
              {conflict.group}
            </Text>
            <Text fw={600} className="break-words">
              {conflict.label}
            </Text>
          </div>
          <Badge variant="light" color={choice ? "green" : "orange"}>
            {choice ? "Resolved" : "Needs choice"}
          </Badge>
        </Group>
        {conflict.scope !== "field" && (
          <Text size="sm" c="dimmed">
            Choosing a version replaces this whole {conflict.kind}.
          </Text>
        )}
        {plainText ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextValue side={conflict.local} heading="My current value" />
            <TextValue side={conflict.remote} heading="Incoming value" />
          </div>
        ) : (
          <JsonDiffViewer left={conflict.local} right={conflict.remote} />
        )}
        <Radio.Group
          value={choice ?? null}
          onChange={(value) => onChoose(value as ConflictPreference)}
          aria-label={`Version to keep for ${name}`}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Radio value="local" label="Keep mine" disabled={disabled} />
            <Radio value="remote" label="Use incoming" disabled={disabled} />
          </div>
        </Radio.Group>
      </Stack>
    </Paper>
  );
}

type ProjectConflictResolutionProps = {
  projectId: string;
  message: string;
  onClose(): void;
};

/** Lets the user settle each clashing field with this tab's value or the newer one. */
export default function ProjectConflictResolution({
  projectId,
  message,
  onClose,
}: ProjectConflictResolutionProps) {
  const store = useStore();
  const [conflicts, setConflicts] = useState<SyncConflict[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ConflictChoices>({});
  const [view, setView] = useState<ViewMode>("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const project = useAtomValue(workspaceAtom).projects.find((record) => record.id === projectId);

  const load = useCallback(async () => {
    const sync = store.get(projectSyncActionsAtom);
    if (!sync) return;
    setLoadError(null);
    setConflicts(null);
    try {
      setConflicts(await sync.previewProjectConflict(projectId));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Could not load the changes.");
    }
  }, [store, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolved = conflicts?.filter((conflict) => choices[conflict.key]).length ?? 0;
  const complete = conflicts !== null && resolved === conflicts.length;

  const chooseAll = (choice: ConflictPreference) =>
    setChoices(Object.fromEntries((conflicts ?? []).map((conflict) => [conflict.key, choice])));

  const apply = async () => {
    const sync = store.get(projectSyncActionsAtom);
    if (!sync || busy || !conflicts || !complete) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sync.resolveProjectConflict(projectId, choices, conflicts);
      onClose();
      notifications.show({
        title: "Choices saved",
        message: "Everything else either of you changed was kept.",
        color: "green",
      });
    } catch (cause) {
      if (cause instanceof ProjectConflictChangedError) {
        // Keep only choices for conflicts that are still exactly what was reviewed.
        const kept = Object.fromEntries(
          cause.conflicts.flatMap((next) => {
            const before = conflicts.find((conflict) => conflict.key === next.key);
            const choice = choices[next.key];
            return before && choice && equalData(before, next) ? [[next.key, choice]] : [];
          }),
        );
        setConflicts(cause.conflicts);
        setChoices(kept);
        setNotice(cause.message);
      } else {
        setError(cause instanceof Error ? cause.message : "Could not resolve the conflict.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened
      size="xl"
      onClose={onClose}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
      title="Your changes conflict with newer ones"
    >
      <Stack>
        <Text size="sm" c="dimmed">
          Choose a version for each change you both made in{" "}
          {project ? `"${projectDisplayName(project.state)}"` : "this project"}. Everything else
          either of you changed is kept.
        </Text>
        {loadError ? (
          <Alert color="red" title="Could not load the changes">
            <Stack gap="xs" align="flex-start">
              <Text size="sm">{loadError}</Text>
              <Text size="sm" c="dimmed">
                {message}
              </Text>
              <Button size="xs" variant="light" onClick={() => void load()}>
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : conflicts === null ? (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm">Loading the latest changes…</Text>
          </Group>
        ) : (
          <>
            <Group justify="space-between">
              <SegmentedControl
                aria-label="Comparison view"
                value={view}
                onChange={(value) => setView(value as ViewMode)}
                data={[
                  { value: "text", label: "Text" },
                  { value: "json", label: "JSON diff" },
                ]}
              />
              <Text size="sm" aria-live="polite">
                {resolved} of {conflicts.length} resolved
              </Text>
            </Group>
            {conflicts.length > 1 && (
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={busy}
                  onClick={() => chooseAll("local")}
                >
                  Keep all mine
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={busy}
                  onClick={() => chooseAll("remote")}
                >
                  Use all incoming
                </Button>
              </Group>
            )}
            {notice && <Alert color="yellow">{notice}</Alert>}
            {conflicts.length === 0 ? (
              <Text size="sm">
                Nothing needs a choice any more. Applying keeps both sides' changes.
              </Text>
            ) : (
              conflicts.map((conflict) => (
                <ConflictCard
                  key={conflict.key}
                  conflict={conflict}
                  view={view}
                  choice={choices[conflict.key]}
                  disabled={busy}
                  onChoose={(choice) =>
                    setChoices((previous) => ({ ...previous, [conflict.key]: choice }))
                  }
                />
              ))
            )}
          </>
        )}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!complete || !project} onClick={() => void apply()}>
            Apply choices
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
