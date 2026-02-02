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
  Tooltip
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

export interface DownloadSection {
  key: string;
  label: string;
  /** Number of validation errors (missing required fields, format errors, etc.) */
  missingFields: number;
  enabled: boolean;
  disabled?: boolean; // If true, checkbox is grayed out and not toggleable
  disabledReason?: string; // Tooltip/explanation for why it's disabled
  /** Number of items in this section (e.g., 2 experiments, 3 datasets) */
  itemCount?: number;
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
  /**
   * Callback fired after modal exit transition completes.
   * Used to trigger validation after modal is fully closed.
   */
  onExitTransitionEnd?: () => void;
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
  onViewErrors,
  onExitTransitionEnd
}: DownloadModalProps) {
  // Calculate total validation errors across enabled sections
  const totalErrors = sections
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + s.missingFields, 0);

  const hasWarnings = totalErrors > 0;
  const hasSelection = sections.some((s) => s.enabled);

  const handleDownload = () => {
    const selectedKeys = sections.filter((s) => s.enabled).map((s) => s.key);
    onDownload(selectedKeys);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={onExitTransitionEnd}
      title={title}
      centered
      size="md"
    >
      <Stack gap="md">
        <Stack gap="sm">
          <Text>Select which types of metadata to include:</Text>

          {sections.map((section) => {
            // Build label with item count if > 1 (e.g., "Experiments (2)")
            // Don't show count for single items like Project
            const labelWithCount =
              section.itemCount !== undefined && section.itemCount > 1
                ? `${section.label} (${section.itemCount})`
                : section.label;

            return (
            <Group key={section.key} justify="space-between" wrap="nowrap">
              {section.disabled && section.disabledReason ? (
                <Tooltip label={section.disabledReason} position="right">
                  <Checkbox
                    label={labelWithCount}
                    checked={section.enabled}
                    disabled
                    styles={{ label: { color: "var(--mantine-color-dimmed)" } }}
                  />
                </Tooltip>
              ) : (
                <Checkbox
                  label={labelWithCount}
                  checked={section.enabled}
                  disabled={section.disabled}
                  onChange={() => onSectionToggle(section.key)}
                />
              )}
              <Group gap="xs">
                {!section.disabled && section.missingFields > 0 && (
                  <Badge color="orange" variant="light" size="sm">
                    {section.missingFields} validation error
                    {section.missingFields !== 1 ? "s" : ""}
                  </Badge>
                )}
                {section.disabled && section.disabledReason && (
                  <Badge color="gray" variant="light" size="sm">
                    {section.disabledReason}
                  </Badge>
                )}
              </Group>
            </Group>
            );
          })}
        </Stack>
        {hasWarnings && (
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="yellow"
            variant="light"
            py="sm"
          >
            <Text size="sm" c="dark.6">
              Some required fields are missing or incomplete. However, you can
              still download as a draft to save your work in progress.
            </Text>
          </Alert>
        )}

        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="default" onClick={onViewErrors || onClose}>
            Go Back
          </Button>
          <Button
            variant="filled"
            onClick={handleDownload}
            disabled={!hasSelection}
          >
            {hasWarnings ? "Download Anyway" : "Download"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
