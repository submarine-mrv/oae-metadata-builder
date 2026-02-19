"use client";

import { useState } from "react";
import { Group, Text, Tooltip, ActionIcon } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import DescriptionModal from "../rjsf/DescriptionModal";

export type DescriptionMode = "tooltip" | "modal" | "placeholder" | "none";

interface FieldLabelProps {
  title: string;
  description?: string;
  required: boolean;
  /** How to display the description. Default is "tooltip" */
  descriptionMode?: DescriptionMode;
}

/**
 * Shared label component for Variable Modal field components.
 * Renders title + required asterisk + description (tooltip, modal, or none).
 */
export default function FieldLabel({
  title,
  description,
  required,
  descriptionMode = "tooltip"
}: FieldLabelProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const titleNode = (
    <Text size="sm" fw={500}>
      {title} {required && <span style={{ color: "red" }}>*</span>}
    </Text>
  );

  // No description, or mode is none/placeholder — just show the title
  if (!description || descriptionMode === "none" || descriptionMode === "placeholder") {
    return titleNode;
  }

  // Modal mode
  if (descriptionMode === "modal") {
    return (
      <>
        <Group gap={4}>
          {titleNode}
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onClick={() => setModalOpen(true)}
            style={{ cursor: "pointer" }}
          >
            <IconInfoCircle size={14} />
          </ActionIcon>
        </Group>
        <DescriptionModal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          title={title}
          description={description}
        />
      </>
    );
  }

  // Default: tooltip mode
  return (
    <Group gap={4}>
      {titleNode}
      <Tooltip
        label={description}
        position="top"
        withArrow
        multiline
        maw={400}
        style={{ wordWrap: "break-word" }}
      >
        <ActionIcon variant="transparent" size="xs" color="gray">
          <IconInfoCircle size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
