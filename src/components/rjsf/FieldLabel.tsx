import React, { useState } from "react";
import { Group, Text, Tooltip, ActionIcon } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import DescriptionModal from "./DescriptionModal";

interface FieldLabelProps {
  label: string;
  description?: string;
  required?: boolean;
  useModal?: boolean;
  order?: 4 | 5 | 6; // Title order
  fw?: number; // Font weight
}

/**
 * Reusable field label component with tooltip or modal support for descriptions
 * Used consistently across custom fields and templates
 */
const FieldLabel: React.FC<FieldLabelProps> = ({
  label,
  description,
  required = false,
  useModal = false,
  order = 5,
  fw = 500
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  // If no description, just render the label
  if (!description) {
    return (
      <Text size="sm" fw={fw} mb="xs">
        {label} {required && <span style={{ color: "red" }}>*</span>}
      </Text>
    );
  }

  return (
    <>
      <Group gap={4} mb="xs">
        <Text size="sm" fw={fw}>
          {label} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
        {useModal ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onClick={() => setModalOpen(true)}
            style={{ cursor: "pointer" }}
          >
            <IconInfoCircle size={14} />
          </ActionIcon>
        ) : (
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
        )}
      </Group>
      {useModal && (
        <DescriptionModal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          title={label}
          description={description}
        />
      )}
    </>
  );
};

/**
 * Smaller version for inline field labels (not titles)
 */
export const FieldLabelSmall: React.FC<
  Omit<FieldLabelProps, "order" | "fw">
> = (props) => {
  const [modalOpen, setModalOpen] = useState(false);
  const { label, description, required = false, useModal = false } = props;

  // If no description, just render the label
  if (!description) {
    return (
      <Text size="sm" fw={500}>
        {label} {required && <span style={{ color: "red" }}>*</span>}
      </Text>
    );
  }

  return (
    <>
      <Group gap={4} mb={4}>
        <Text size="sm" fw={500}>
          {label} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
        {useModal ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onClick={() => setModalOpen(true)}
            style={{ cursor: "pointer" }}
          >
            <IconInfoCircle size={14} />
          </ActionIcon>
        ) : (
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
        )}
      </Group>
      {useModal && (
        <DescriptionModal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          title={label}
          description={description}
        />
      )}
    </>
  );
};

export default FieldLabel;
