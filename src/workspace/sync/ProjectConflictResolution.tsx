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
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconChevronRight } from "@tabler/icons-react";
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

type TextValueProps = { side: DiffSide; heading: string; tone: "local" | "cloud" };

function TextValue({ side, heading, tone }: TextValueProps) {
  return (
    <Paper
      withBorder
      p="sm"
      bg={tone === "local" ? "progressBlue.0" : "coral.0"}
      className="min-w-0"
    >
      <Text size="xs" fw={600} c={tone === "local" ? "progressBlue" : "coral"}>
        {heading}
      </Text>
      {!side.present ? (
        <Text size="sm" fs="italic" c="dimmed">
          Not set
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
    </Paper>
  );
}

type ConflictCardProps = { conflict: SyncConflict; view: ViewMode };

function ConflictCard({ conflict, view }: ConflictCardProps) {
  const plainText = view === "text" && isScalar(conflict.local) && isScalar(conflict.remote);
  const name = `${conflict.group}: ${conflict.label}`;
  return (
    <section aria-label={name} className="min-w-0">
      <Stack gap="md">
        <div>
          <Text size="xs" c="dimmed">
            {conflict.group}
          </Text>
          <Text fw={600} className="break-words">
            {conflict.label}
          </Text>
        </div>
        {conflict.scope !== "field" && (
          <Text size="sm" c="dimmed">
            Choosing a version replaces this whole {conflict.kind}.
          </Text>
        )}
        {plainText ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <TextValue side={conflict.local} heading="Local version" tone="local" />
            <TextValue side={conflict.remote} heading="Cloud version" tone="cloud" />
          </div>
        ) : (
          <JsonDiffViewer
            left={conflict.local}
            right={conflict.remote}
            leftLabel="Local version"
            rightLabel="Cloud version"
          />
        )}
      </Stack>
    </section>
  );
}

const CHOICE_BADGE: Record<ConflictPreference | "none", { label: string; color: string }> = {
  local: { label: "Local", color: "progressBlue" },
  remote: { label: "Cloud", color: "coral" },
  none: { label: "Choose", color: "midnight" },
};

type FieldNavigatorProps = {
  conflicts: SyncConflict[];
  activeKey: string | undefined;
  choices: ConflictChoices;
  onSelect(key: string): void;
};

/** Conflicting fields grouped under their project, experiment or dataset. */
function FieldNavigator({ conflicts, activeKey, choices, onSelect }: FieldNavigatorProps) {
  const groups = [...new Set(conflicts.map((conflict) => conflict.group))];
  return (
    <nav
      aria-label="Conflicting fields"
      className="min-h-0 overflow-y-auto border-r border-twilight bg-shell px-3 py-4"
    >
      <Stack gap="lg">
        {groups.map((group) => (
          <div key={group}>
            <Text
              size="xs"
              fw={600}
              c="dimmed"
              tt="uppercase"
              px="sm"
              mb={6}
              className="tracking-wide"
            >
              {group}
            </Text>
            <Stack gap={4}>
              {conflicts
                .filter((conflict) => conflict.group === group)
                .map((conflict) => {
                  const selected = activeKey === conflict.key;
                  const badge = CHOICE_BADGE[choices[conflict.key] ?? "none"];
                  return (
                    <button
                      key={conflict.key}
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => onSelect(conflict.key)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-twilight bg-white shadow-sm"
                          : "border-transparent hover:bg-white"
                      }`}
                    >
                      <Text size="sm" fw={selected ? 600 : 500} className="min-w-0 break-words">
                        {conflict.label}
                      </Text>
                      <Badge size="sm" radius="xl" variant="light" color={badge.color} tt="none">
                        {badge.label}
                      </Badge>
                    </button>
                  );
                })}
            </Stack>
          </div>
        ))}
      </Stack>
    </nav>
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
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [conflicts, setConflicts] = useState<SyncConflict[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ConflictChoices>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
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
      const next = await sync.previewProjectConflict(projectId);
      setConflicts(next);
      setActiveKey((current) =>
        next.some((conflict) => conflict.key === current) ? current : (next[0]?.key ?? null),
      );
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Could not load the changes.");
    }
  }, [store, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolved = conflicts?.filter((conflict) => choices[conflict.key]).length ?? 0;
  const complete = conflicts !== null && resolved === conflicts.length;
  const activeConflict =
    conflicts?.find((conflict) => conflict.key === activeKey) ?? conflicts?.[0];
  const activeIndex = activeConflict
    ? (conflicts?.findIndex((conflict) => conflict.key === activeConflict.key) ?? 0)
    : -1;

  const chooseAll = (choice: ConflictPreference) =>
    setChoices(Object.fromEntries((conflicts ?? []).map((conflict) => [conflict.key, choice])));

  const moveTo = (direction: -1 | 1) => {
    if (!conflicts?.length || activeIndex < 0) return;
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= conflicts.length) return;
    setActiveKey(conflicts[nextIndex].key);
  };

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
        const kept = Object.fromEntries(
          cause.conflicts.flatMap((next) => {
            const before = conflicts.find((conflict) => conflict.key === next.key);
            const choice = choices[next.key];
            return before && choice && equalData(before, next) ? [[next.key, choice]] : [];
          }),
        );
        setConflicts(cause.conflicts);
        setActiveKey((current) =>
          cause.conflicts.some((conflict) => conflict.key === current)
            ? current
            : (cause.conflicts[0]?.key ?? null),
        );
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
      fullScreen={isMobile}
      size="min(96vw, 1440px)"
      onClose={onClose}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
      title="Your changes conflict with newer ones"
      styles={{
        content: {
          display: "flex",
          flexDirection: "column",
          maxHeight: isMobile ? "100dvh" : "calc(100dvh - 2rem)",
        },
        body: { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" },
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-twilight px-3 pb-3 sm:px-5">
          <Text size="sm" c="dimmed">
            Choose a version for each change you both made in{" "}
            {project ? `"${projectDisplayName(project.state)}"` : "this project"}. Everything else
            either of you changed is kept.
          </Text>
          {conflicts && conflicts.length > 0 && (
            <Group justify="space-between" align="center" wrap="wrap" gap="sm" mt="sm">
              <Group gap="xs">
                {conflicts.length > 1 && (
                  <>
                    <Button
                      size="xs"
                      variant="light"
                      color="progressBlue"
                      disabled={busy}
                      onClick={() => chooseAll("local")}
                    >
                      Local for all
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="coral"
                      disabled={busy}
                      onClick={() => chooseAll("remote")}
                    >
                      Cloud for all
                    </Button>
                  </>
                )}
              </Group>
              <SegmentedControl
                aria-label="Comparison view"
                value={view}
                onChange={(value) => setView(value as ViewMode)}
                data={[
                  { value: "text", label: "Text" },
                  { value: "json", label: "JSON diff" },
                ]}
              />
            </Group>
          )}
        </div>

        {loadError ? (
          <Alert color="red" title="Could not load the changes" m="md">
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
          <Group gap="xs" p="md">
            <Loader size="sm" />
            <Text size="sm">Loading the latest changes…</Text>
          </Group>
        ) : conflicts.length === 0 ? (
          <Text size="sm" p="md">
            Nothing needs a choice any more. Applying keeps both sides&apos; changes.
          </Text>
        ) : (
          <div
            className={
              conflicts.length > 1 && !isMobile
                ? "grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)]"
                : "flex min-h-0 flex-1 flex-col"
            }
          >
            {conflicts.length > 1 && !isMobile && (
              <FieldNavigator
                conflicts={conflicts}
                activeKey={activeConflict?.key}
                choices={choices}
                onSelect={setActiveKey}
              />
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {conflicts.length > 1 && isMobile && (
                <Group justify="space-between" p="sm" className="border-b border-twilight">
                  <Button
                    variant="subtle"
                    size="xs"
                    disabled={busy || activeIndex === 0}
                    onClick={() => moveTo(-1)}
                    aria-label="Previous field"
                  >
                    Previous
                  </Button>
                  <Text size="sm" fw={600} aria-live="polite">
                    Field {activeIndex + 1} of {conflicts.length}
                  </Text>
                  <Button
                    variant="subtle"
                    size="xs"
                    disabled={busy || activeIndex === conflicts.length - 1}
                    onClick={() => moveTo(1)}
                    aria-label="Next field"
                  >
                    Next
                  </Button>
                </Group>
              )}
              {notice && (
                <Alert color="yellow" m="sm">
                  {notice}
                </Alert>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                {activeConflict && <ConflictCard conflict={activeConflict} view={view} />}
              </div>
              {activeConflict && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-twilight px-3 py-3 sm:px-5">
                  <Radio.Group
                    value={choices[activeConflict.key] ?? null}
                    onChange={(value) =>
                      setChoices((previous) => ({
                        ...previous,
                        [activeConflict.key]: value as ConflictPreference,
                      }))
                    }
                    label={`Version to keep for ${activeConflict.group}: ${activeConflict.label}`}
                    labelProps={{ className: "sr-only" }}
                  >
                    <Group gap="lg">
                      <Radio
                        value="local"
                        label="Keep Local version"
                        disabled={busy}
                        color="progressBlue"
                      />
                      <Radio
                        value="remote"
                        label="Use Cloud version"
                        disabled={busy}
                        color="coral"
                      />
                    </Group>
                  </Radio.Group>
                  {conflicts.length > 1 && !isMobile && (
                    <Button
                      variant="subtle"
                      rightSection={<IconChevronRight size={16} />}
                      disabled={busy || activeIndex === conflicts.length - 1}
                      onClick={() => moveTo(1)}
                    >
                      Next field
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <Alert color="red" mx="md" mb="sm">
            {error}
          </Alert>
        )}
        {conflicts !== null && (
          <Group justify="space-between" p="sm" className="border-t border-twilight sm:px-5">
            <Text size="sm" aria-live="polite">
              {conflicts.length === 0
                ? "No choices needed"
                : `${resolved} of ${conflicts.length} chosen`}
            </Text>
            <Group gap="xs">
              <Button variant="default" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button loading={busy} disabled={!complete || !project} onClick={() => void apply()}>
                Apply choices
              </Button>
            </Group>
          </Group>
        )}
      </div>
    </Modal>
  );
}
