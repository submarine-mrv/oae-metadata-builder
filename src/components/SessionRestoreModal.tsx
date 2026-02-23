"use client";
import React from "react";
import { Modal, Text, Group, Button, Stack } from "@mantine/core";
import type { SavedSession } from "@/hooks/useSessionPersistence";

function formatTimeAgo(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 minute ago";
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHrs = Math.round(diffMin / 60);
  if (diffHrs === 1) return "1 hour ago";
  if (diffHrs < 24) return `${diffHrs} hours ago`;
  const diffDays = Math.round(diffHrs / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

interface SessionRestoreModalProps {
  opened: boolean;
  session: SavedSession;
  onRestore: () => void;
  onDiscard: () => void;
}

export default function SessionRestoreModal({
  opened,
  session,
  onRestore,
  onDiscard
}: SessionRestoreModalProps) {
  const projectCount = session.hasProject ? 1 : 0;
  const experimentCount = session.experiments.length;
  const datasetCount = session.datasets.length;
  const timeAgo = formatTimeAgo(session.savedAt);

  const parts: string[] = [];
  if (projectCount > 0) parts.push(`${projectCount} project`);
  if (experimentCount > 0)
    parts.push(
      `${experimentCount} experiment${experimentCount !== 1 ? "s" : ""}`
    );
  if (datasetCount > 0)
    parts.push(`${datasetCount} dataset${datasetCount !== 1 ? "s" : ""}`);
  const summary = parts.join(", ");

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      title="Previous Session Found"
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      transitionProps={{ transition: "fade", duration: 150 }}
      trapFocus={false}
    >
      <Stack gap="lg">
        <Text size="sm">
          An autosaved session from {timeAgo} was found containing {summary}.
        </Text>
        <Text size="sm">Would you like to restore this session?</Text>
        <Group justify="flex-end">
          <Button variant="outline" onClick={onDiscard}>
            Start Fresh
          </Button>
          <Button onClick={onRestore}>Restore Session</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
