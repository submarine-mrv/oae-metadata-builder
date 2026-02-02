import React from "react";
import {
  Modal,
  Table,
  Checkbox,
  Button,
  Group,
  Stack,
  Text,
  Alert
} from "@mantine/core";
import { IconAlertTriangle, IconFileImport } from "@tabler/icons-react";
import type { ImportItem } from "@/hooks/useImportPreview";

interface ImportPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  filename: string;
  items: ImportItem[];
  onToggleItem: (key: string) => void;
  onImport: () => void;
}

/**
 * Modal for previewing and selecting items to import.
 * Shows a table with checkboxes, item details, and conflict indicators.
 */
export default function ImportPreviewModal({
  opened,
  onClose,
  filename,
  items,
  onToggleItem,
  onImport
}: ImportPreviewModalProps) {
  const selectedCount = items.filter((item) => item.selected).length;
  const hasOverrides = items.some(
    (item) => item.selected && item.conflict === "override"
  );
  const noneSelected = selectedCount === 0;

  // Group items by type for display
  const projectItems = items.filter((item) => item.type === "project");
  const experimentItems = items.filter((item) => item.type === "experiment");
  const datasetItems = items.filter((item) => item.type === "dataset");

  const renderOverrideText = (item: ImportItem) => {
    if (item.conflict === "override") {
      return <Text size="sm">{item.conflictReason}</Text>;
    }
    return (
      <Text size="sm" c="dimmed">
        Create new metadata record
      </Text>
    );
  };

  const renderRow = (item: ImportItem) => (
    <Table.Tr
      key={item.key}
      style={{
        opacity: item.selected ? 1 : 0.5
      }}
    >
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
        {item.id && item.id !== item.name && (
          <Text size="xs" c="dimmed">
            ID: {item.id}
          </Text>
        )}
      </Table.Td>
      <Table.Td>{renderOverrideText(item)}</Table.Td>
    </Table.Tr>
  );

  const renderSection = (title: string, sectionItems: ImportItem[]) => {
    if (sectionItems.length === 0) {
      return null;
    }

    return (
      <>
        <Table.Tr>
          <Table.Td
            colSpan={3}
            style={{ backgroundColor: "var(--mantine-color-gray-1)" }}
          >
            <Text size="sm" fw={600} c="dimmed">
              {title} Metadata
            </Text>
          </Table.Td>
        </Table.Tr>
        {sectionItems.map(renderRow)}
      </>
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
        <Text size="sm" c="dimmed">
          Importing from: <strong>{filename}</strong>
        </Text>

        {/* Items table */}
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}></Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Import Strategy</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {renderSection("Project", projectItems)}
            {renderSection("Experiment", experimentItems)}
            {renderSection("Dataset", datasetItems)}
            {items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text ta="center" c="dimmed" py="md">
                    No items found in the imported file
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {/* Warning for overrides */}
        {hasOverrides && (
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="orange"
            variant="light"
          >
            <Text size="sm">
              Some selected items will override existing data. This cannot be
              undone.
            </Text>
          </Alert>
        )}

        {/* Action buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onImport}
            disabled={noneSelected}
            color={hasOverrides ? "orange" : undefined}
          >
            Import {selectedCount} item{selectedCount !== 1 ? "s" : ""}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
