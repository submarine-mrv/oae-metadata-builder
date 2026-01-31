import React from "react";
import {
  Modal,
  Alert,
  Button,
  Group,
  Checkbox,
  Stack,
  Text,
  Badge,
  Tooltip,
  Anchor
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

export interface DownloadSection {
  key: string;
  label: string;
  missingFields: number;
  incompleteItems?: number; // For variables
  incompleteItemLabel?: string; // e.g., "variable"
  enabled: boolean;
  disabled?: boolean; // If true, checkbox is grayed out and not toggleable
  disabledReason?: string; // Tooltip/explanation for why it's disabled
}

interface DownloadModalProps {
  opened: boolean;
  onClose: () => void;
  onDownload: (selectedSections: string[]) => void;
  title: string;
  sections: DownloadSection[];
  onSectionToggle: (key: string) => void;
  /**
   * Callback when user clicks "View Errors" link.
   * The page should close the modal, trigger validation, and scroll to errors.
   */
  onViewErrors?: () => void;
}

/**
 * DownloadModal - Modal for downloading metadata with soft validation.
 * Shows warnings for missing fields (informational only) and allows download regardless.
 * Designed for reuse across Project, Experiment, and Dataset pages.
 */
export default function DownloadModal({
  opened,
  onClose,
  onDownload,
  title,
  sections,
  onSectionToggle,
  onViewErrors
}: DownloadModalProps) {
  // Calculate total missing fields across enabled sections
  const totalMissing = sections
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + s.missingFields, 0);

  const totalIncomplete = sections
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.incompleteItems || 0), 0);

  const hasWarnings = totalMissing > 0 || totalIncomplete > 0;
  const hasSelection = sections.some((s) => s.enabled);

  const handleDownload = () => {
    const selectedKeys = sections.filter((s) => s.enabled).map((s) => s.key);
    onDownload(selectedKeys);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="md">
      <Stack gap="md">
        {hasWarnings && (
          <Alert
            icon={<IconAlertTriangle size={20} />}
            title="Some required fields are missing"
            color="yellow"
            variant="light"
          >
            You can still download as a draft.
            {onViewErrors && (
              <>
                {" "}
                <Anchor
                  component="button"
                  type="button"
                  onClick={onViewErrors}
                  size="sm"
                >
                  View errors
                </Anchor>
              </>
            )}
          </Alert>
        )}

        <Stack gap="sm">
          <Text fw={500}>Select what to include:</Text>

          {sections.map((section) => (
            <Group key={section.key} justify="space-between" wrap="nowrap">
              {section.disabled && section.disabledReason ? (
                <Tooltip label={section.disabledReason} position="right">
                  <Checkbox
                    label={section.label}
                    checked={section.enabled}
                    disabled
                    styles={{ label: { color: "var(--mantine-color-dimmed)" } }}
                  />
                </Tooltip>
              ) : (
                <Checkbox
                  label={section.label}
                  checked={section.enabled}
                  disabled={section.disabled}
                  onChange={() => onSectionToggle(section.key)}
                />
              )}
              <Group gap="xs">
                {!section.disabled && section.missingFields > 0 && (
                  <Badge color="orange" variant="light" size="sm">
                    {section.missingFields} field
                    {section.missingFields !== 1 ? "s" : ""} missing
                  </Badge>
                )}
                {!section.disabled &&
                  section.incompleteItems !== undefined &&
                  section.incompleteItems > 0 && (
                    <Badge color="orange" variant="light" size="sm">
                      {section.incompleteItems}{" "}
                      {section.incompleteItemLabel || "item"}
                      {section.incompleteItems !== 1 ? "s" : ""} incomplete
                    </Badge>
                  )}
                {section.disabled && section.disabledReason && (
                  <Badge color="gray" variant="light" size="sm">
                    {section.disabledReason}
                  </Badge>
                )}
              </Group>
            </Group>
          ))}
        </Stack>

        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="filled" onClick={handleDownload} disabled={!hasSelection}>
            Download
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
