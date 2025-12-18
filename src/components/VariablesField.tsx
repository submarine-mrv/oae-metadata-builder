"use client";

import React, { useState } from "react";
import type { FieldProps } from "@rjsf/utils";
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Table,
  ActionIcon
} from "@mantine/core";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import VariableModal from "./VariableModal";
import { getVariableTypeLabel } from "@/utils/schemaViews";
import type { VariableFormData } from "@/types/forms";
import { brandColors } from "@/theme";

/**
 * VariablesField - A custom RJSF field for managing dataset variables.
 * Renders as a bordered section with a table of variables and Add/Edit/Delete actions.
 * Integrates with VariableModal for adding and editing variables.
 */
const VariablesField: React.FC<FieldProps> = (props) => {
  const { formData, onChange, disabled, readonly, fieldPathId } = props;

  // Ensure formData is an array
  const variables: VariableFormData[] = Array.isArray(formData) ? formData : [];

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleChange = (newVariables: VariableFormData[]) => {
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

  const handleSave = (variableData: VariableFormData) => {
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
          backgroundColor: "var(--brand-sunlight-overlay-light)"
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
            No variables added yet. Click &quot;Add Variable&quot; to define the
            variables in your dataset.
          </Text>
        ) : (
          <Table striped stripedColor={brandColors.sunlight} highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Variable Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th style={{ width: 100 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {variables.map((variable, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    {variable.dataset_variable_name || "(unnamed)"}
                  </Table.Td>
                  <Table.Td>
                    {variable.variable_type
                      ? getVariableTypeLabel(variable.variable_type)
                      : "(no type)"}
                  </Table.Td>
                  <Table.Td>{variable.variable_unit || "-"}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
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
        initialData={
          editingIndex !== null ? variables[editingIndex] : undefined
        }
      />
    </>
  );
};

export default VariablesField;
