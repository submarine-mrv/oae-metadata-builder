import React from "react";
import {
  Modal,
  Table,
  Checkbox,
  Button,
  Group,
  Stack,
  Text,
  Alert,
  Select,
  Tooltip
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconFileImport,
  IconCheck
} from "@tabler/icons-react";
import type {
  ImportItem,
  ExperimentLinkOption,
  DatasetExperimentLinking
} from "@/hooks/useImportPreview";

interface ImportPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  filename: string;
  items: ImportItem[];
  onToggleItem: (key: string) => void;
  onSetDatasetLinking: (
    datasetKey: string,
    mode: "use-file" | "explicit",
    explicitExperimentInternalId?: number,
    explicitImportKey?: string
  ) => void;
  getExperimentLinkOptions: (datasetKey: string) => ExperimentLinkOption[];
  duplicateExperimentIdError: string | null;
  onImport: () => void;
}

/**
 * Section header component for consistent styling
 */
function SectionHeader({ title }: { title: string }) {
  return (
    <Text size="sm" fw={600} c="dimmed" mb="xs">
      {title}
    </Text>
  );
}

/**
 * Modal for previewing and selecting items to import.
 * Shows separate sections for projects, experiments, and datasets.
 */
export default function ImportPreviewModal({
  opened,
  onClose,
  filename,
  items,
  onToggleItem,
  onSetDatasetLinking,
  getExperimentLinkOptions,
  duplicateExperimentIdError,
  onImport
}: ImportPreviewModalProps) {
  const selectedCount = items.filter((item) => item.selected).length;
  const noneSelected = selectedCount === 0;
  const hasBlockingError = duplicateExperimentIdError !== null;

  // Group items by type
  const projectItems = items.filter((item) => item.type === "project");
  const experimentItems = items.filter((item) => item.type === "experiment");
  const datasetItems = items.filter((item) => item.type === "dataset");

  // Build summary text
  const summaryParts: string[] = [];
  if (projectItems.length > 0) {
    summaryParts.push("project metadata");
  }
  if (experimentItems.length > 0) {
    summaryParts.push(
      `${experimentItems.length} experiment${experimentItems.length !== 1 ? "s" : ""}`
    );
  }
  if (datasetItems.length > 0) {
    summaryParts.push(
      `${datasetItems.length} dataset${datasetItems.length !== 1 ? "s" : ""}`
    );
  }

  /**
   * Parse the select value and call the linking handler
   */
  const handleLinkingChange = (datasetKey: string, value: string | null) => {
    if (!value) return;

    if (value === "use-file") {
      onSetDatasetLinking(datasetKey, "use-file");
    } else if (value.startsWith("existing-")) {
      const internalId = parseInt(value.replace("existing-", ""), 10);
      onSetDatasetLinking(datasetKey, "explicit", internalId, undefined);
    } else if (value.startsWith("importing-")) {
      const importKey = value.replace("importing-", "");
      onSetDatasetLinking(datasetKey, "explicit", undefined, importKey);
    }
  };

  /**
   * Get the current select value for a dataset's linking
   */
  const getLinkingSelectValue = (
    linking: DatasetExperimentLinking | undefined
  ): string => {
    if (!linking || linking.mode === "use-file") {
      return "use-file";
    }
    if (linking.explicitExperimentInternalId !== undefined) {
      return `existing-${linking.explicitExperimentInternalId}`;
    }
    if (linking.explicitImportKey) {
      return `importing-${linking.explicitImportKey}`;
    }
    return "use-file";
  };

  /**
   * Render a warning icon with tooltip for override conflicts
   */
  const renderWarningIcon = (
    item: ImportItem,
    tooltipText: string
  ): React.ReactNode => {
    if (item.conflict !== "override") {
      return null;
    }
    return (
      <Tooltip label={tooltipText} withArrow>
        <IconAlertTriangle size={16} color="var(--mantine-color-orange-6)" />
      </Tooltip>
    );
  };

  const renderExperimentRow = (item: ImportItem) => {
    return (
      <Table.Tr key={item.key} style={{ opacity: item.selected ? 1 : 0.5 }}>
        <Table.Td>
          <Checkbox
            checked={item.selected}
            onChange={() => onToggleItem(item.key)}
            aria-label={`Select ${item.name}`}
          />
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500}>
            {item.name}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c={item.id ? undefined : "dimmed"}>
            {item.id || "—"}
          </Text>
        </Table.Td>
        <Table.Td style={{ width: 40 }}>
          {renderWarningIcon(
            item,
            "Experiments with the same experiment_id will be overwritten"
          )}
        </Table.Td>
      </Table.Tr>
    );
  };

  const renderDatasetRow = (item: ImportItem) => {
    // Get per-dataset options
    const selectData = getExperimentLinkOptions(item.key);

    return (
      <Table.Tr key={item.key} style={{ opacity: item.selected ? 1 : 0.5 }}>
        <Table.Td>
          <Checkbox
            checked={item.selected}
            onChange={() => onToggleItem(item.key)}
            aria-label={`Select ${item.name}`}
          />
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500}>
            {item.name}
          </Text>
        </Table.Td>
        <Table.Td>
          <Select
            size="xs"
            data={selectData}
            value={getLinkingSelectValue(item.experimentLinking)}
            onChange={(value) => handleLinkingChange(item.key, value)}
            disabled={!item.selected}
            styles={{
              input: { minWidth: 200 }
            }}
          />
        </Table.Td>
        <Table.Td style={{ width: 40 }}>
          {renderWarningIcon(
            item,
            "Datasets with the same title will be overwritten"
          )}
        </Table.Td>
      </Table.Tr>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFileImport size={20} />
          <Text fw={600}>Import Preview</Text>
        </Group>
      }
      centered
      size="xl"
    >
      <Stack gap="md">
        {/* Success message with summary */}
        {!duplicateExperimentIdError && summaryParts.length > 0 && (
          <Alert icon={<IconCheck size={18} />} color="teal" variant="light">
            <Text size="sm">OAE metadata file was loaded successfully.</Text>
          </Alert>
        )}

        {/* Duplicate experiment_id error */}
        {duplicateExperimentIdError && (
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="red"
            variant="light"
          >
            <Text size="sm">{duplicateExperimentIdError}</Text>
          </Alert>
        )}

        {/* Project Section */}
        {projectItems.length > 0 && (
          <Stack gap={4}>
            <SectionHeader title="Project Metadata" />
            <Group gap="xs">
              <Checkbox
                checked={projectItems[0].selected}
                onChange={() => onToggleItem(projectItems[0].key)}
                label={
                  <Text size="sm" fw={500}>
                    Import project metadata from file
                  </Text>
                }
              />
              {renderWarningIcon(
                projectItems[0],
                "Existing project metadata will be overwritten"
              )}
            </Group>
          </Stack>
        )}

        {/* Experiments Section */}
        {experimentItems.length > 0 && (
          <Stack gap={4}>
            <SectionHeader title="Experiments" />
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Experiment ID</Table.Th>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {experimentItems.map(renderExperimentRow)}
              </Table.Tbody>
            </Table>
          </Stack>
        )}

        {/* Datasets Section */}
        {datasetItems.length > 0 && (
          <Stack gap={4}>
            <SectionHeader title="Datasets" />
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Linked Experiment</Table.Th>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{datasetItems.map(renderDatasetRow)}</Table.Tbody>
            </Table>
          </Stack>
        )}

        {items.length === 0 && (
          <Text ta="center" c="dimmed" py="md">
            No items found in the imported file
          </Text>
        )}

        {/* Action buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onImport}
            disabled={noneSelected || hasBlockingError}
          >
            Import {selectedCount} item{selectedCount !== 1 ? "s" : ""}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
