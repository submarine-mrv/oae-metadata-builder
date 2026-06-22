import { ActionIcon, Button, Group, Paper, Table, Text, Title, Tooltip } from "@mantine/core";
import type { FieldProps, RJSFValidationError } from "@rjsf/utils";
import { IconAlertCircle, IconCopy, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import type React from "react";
import { useState } from "react";
import { brandColors } from "@/theme";
import type { JSONSchema } from "./schemaUtils";
import VariableModal from "./VariableModal/VariableModal";
import { VARIABLE_TYPE_OPTIONS } from "./VariableModal/variableModalConfig";

// Variable data type (flexible for schema-driven approach)
type VariableData = Record<string, unknown>;

// Build label lookup from the dropdown options + non_measured (not a dropdown option)
const VARIABLE_TYPE_LABEL_MAP: Record<string, string> = {
  ...Object.fromEntries(VARIABLE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])),
  non_measured: "Contextual",
};

function getVariableDisplayLabel(variable: VariableData): string {
  const varType = variable.variable_type as string | undefined;
  if (!varType) return "(no type)";
  return VARIABLE_TYPE_LABEL_MAP[varType] || varType;
}

/**
 * VariablesField - A custom RJSF field for managing dataset variables.
 * Renders as a bordered section with a table of variables and Add/Edit/Delete actions.
 * Integrates with VariableModal for adding and editing variables.
 */
const VariablesField: React.FC<FieldProps> = (props) => {
  const { formData, onChange, disabled, readonly, registry, fieldPathId } = props;

  // Get the root schema from RJSF registry
  const rootSchema = registry.rootSchema as JSONSchema;

  // Per-variable errors come from the single validateDataset() pass (via the
  // dataset page's formContext), so the (!) here matches the badge and overview.
  const formContext = registry.formContext as
    | { variableErrors?: Map<number, RJSFValidationError[]> }
    | undefined;

  // Ensure formData is an array
  const variables: VariableData[] = Array.isArray(formData) ? formData : [];

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleChange = (newVariables: VariableData[]) => {
    // Call onChange with fieldPathId info to properly update the form data
    onChange(newVariables, fieldPathId.path, undefined, fieldPathId.$id);
  };

  const handleAdd = () => {
    setEditingIndex(null);
    setModalOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setModalOpen(true);
  };

  const handleDelete = (index: number) => {
    const newVariables = [...variables];
    newVariables.splice(index, 1);
    handleChange(newVariables);
  };

  const handleDuplicate = (index: number) => {
    const original = variables[index];
    const duplicate: VariableData = {
      ...structuredClone(original),
      dataset_variable_name: `${(original.dataset_variable_name as string) || ""} (Copy)`,
    };
    const newVariables = [...variables, duplicate];
    handleChange(newVariables);
  };

  const handleSave = (variableData: VariableData) => {
    const newVariables = [...variables];
    if (editingIndex !== null) {
      newVariables[editingIndex] = variableData;
    } else {
      newVariables.push(variableData);
    }
    handleChange(newVariables);
    setModalOpen(false);
  };

  const isDisabled = disabled || readonly;

  return (
    <>
      <Paper
        withBorder
        style={{
          backgroundColor: "var(--brand-sunlight-overlay-light)",
        }}
        p="md"
        mt="md"
        mb="md"
      >
        <Group justify="space-between" mb="md">
          <Title order={4}>Variables</Title>
          <Button
            variant="outline"
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
            size="sm"
            disabled={isDisabled}
          >
            Add Variable
          </Button>
        </Group>

        {variables.length === 0 ? (
          <Text c="dimmed" ta="center" py="lg">
            No variables added yet. Click &quot;Add Variable&quot; to define the variables in your
            dataset.
          </Text>
        ) : (
          <Table striped stripedColor={brandColors.sunlight} highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Variable Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th style={{ width: 120 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {variables.map((variable, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Group gap="xs">
                      {(variable.dataset_variable_name as string) || "(unnamed)"}
                      {(() => {
                        const issues = formContext?.variableErrors?.get(index)?.length ?? 0;
                        if (issues > 0) {
                          return (
                            <Tooltip
                              label={`${issues} validation issue${issues > 1 ? "s" : ""} — see error list`}
                            >
                              <IconAlertCircle size={16} color="var(--mantine-color-orange-6)" />
                            </Tooltip>
                          );
                        }
                        return null;
                      })()}
                    </Group>
                  </Table.Td>
                  <Table.Td>{getVariableDisplayLabel(variable)}</Table.Td>
                  <Table.Td>{(variable.units as string) || "-"}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => handleEdit(index)}
                        title="Edit variable"
                        disabled={isDisabled}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        onClick={() => handleDuplicate(index)}
                        title="Duplicate variable"
                        disabled={isDisabled}
                      >
                        <IconCopy size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(index)}
                        title="Delete variable"
                        disabled={isDisabled}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <VariableModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingIndex !== null ? variables[editingIndex] : undefined}
        rootSchema={rootSchema}
      />
    </>
  );
};

export default VariablesField;
