import { ActionIcon, Anchor, Group, type MantineSpacing, Text, Tooltip } from "@mantine/core";
import { IconExternalLink, IconInfoCircle } from "@tabler/icons-react";
import type React from "react";
import { useState } from "react";
import DescriptionModal from "./DescriptionModal";

/**
 * Fields whose controlled vocabulary is published externally get a "view all"
 * link next to the label. Keyed by rendered label so a field picks the link up
 * wherever it appears, without every uiSchema repeating the URL.
 */
export const VIEW_ALL_LINKS: Record<string, string> = {
  "Sea Names": "http://vocab.nerc.ac.uk/collection/C16/current/",
  "MCDR Pathway": "https://www.carbontosea.org/oae-data-protocol/1-0-0/#mcdr-pathways",
  "Dosing Delivery Type":
    "https://www.carbontosea.org/oae-data-protocol/1-0-0/#dosing-delivery-type",
};

interface FieldLabelProps {
  label: string;
  description?: string;
  required?: boolean;
  useModal?: boolean;
  order?: 4 | 5 | 6; // Title order
  fw?: number; // Font weight
  /** Bottom margin. Set to 0 when the caller supplies its own label-row spacing. */
  mb?: MantineSpacing;
  /** Overrides the `VIEW_ALL_LINKS` lookup; pass null to suppress the link. */
  viewAllLink?: string | null;
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
  fw = 500,
  mb = "xs",
  viewAllLink,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const link = viewAllLink === undefined ? VIEW_ALL_LINKS[label] : viewAllLink;

  const titleNode = (
    <Text size="sm" fw={fw}>
      {label} {required && <span style={{ color: "red" }}>*</span>}
    </Text>
  );

  // Nothing to hang off the label — render it on its own
  if (!description && !link) {
    return (
      <Text size="sm" fw={fw} mb={mb}>
        {label} {required && <span style={{ color: "red" }}>*</span>}
      </Text>
    );
  }

  return (
    <>
      <Group gap={4} mb={mb} align="center">
        {titleNode}
        {description &&
          (useModal ? (
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
          ))}
        {link && (
          <Anchor
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            ml="xs"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            view all
            <IconExternalLink size={12} />
          </Anchor>
        )}
      </Group>
      {useModal && description && (
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
 * Smaller version for inline field labels (not titles).
 * Matches FieldLabel apart from the tighter bottom margin.
 */
export const FieldLabelSmall: React.FC<Omit<FieldLabelProps, "order" | "fw">> = (props) => (
  <FieldLabel {...props} mb={props.description ? 4 : 0} />
);

export default FieldLabel;
