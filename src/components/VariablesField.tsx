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
  ActionIcon,
  Tooltip
} from "@mantine/core";
import { IconPlus, IconPencil, IconTrash, IconCopy, IconAlertCircle } from "@tabler/icons-react";
import VariableModal from "./VariableModal/VariableModal";
import { brandColors } from "@/theme";
import {
  resolveRef,
  fieldExistsInSchema,
  isFieldRequired,
  getNestedValue,
  type JSONSchema
} from "./schemaUtils";
import {
  getSchemaKey,
  ACCORDION_CONFIG,
  normalizeFieldConfig
} from "./VariableModal/variableModalConfig";

// Variable data type (flexible for schema-driven approach)
type VariableData = Record<string, unknown>;

/**
 * Gets a display label for the variable type based on _variableType and _schemaKey
 */
function getVariableDisplayLabel(variable: VariableData): string {
  const varType = variable._variableType as string | undefined;
  const schemaKey = variable._schemaKey as string | undefined;

  if (varType === "pH") return "pH";
  if (varType === "observed_property") return "Observed Property";
  if (schemaKey) return schemaKey;
  return "(no type)";
}

/**
 * Counts the number of missing required fields for a variable.
 * Uses the variable's type selections to determine the appropriate schema,
 * then checks all fields defined in ACCORDION_CONFIG.
 */
function countMissingRequiredFields(
  variable: VariableData,
  rootSchema: JSONSchema
): number {
  // Get schema key from variable's type selections
  const schemaKey = getSchemaKey(
    variable._variableType as string | undefined,
    variable.genesis as string | undefined,
    variable.sampling as string | undefined
  );

  if (!schemaKey || !rootSchema.$defs) return 0;

  const variableSchema = resolveRef(
    rootSchema.$defs[schemaKey],
    rootSchema
  );
  if (!variableSchema) return 0;

  // Count missing required fields across all accordion sections
  let missingCount = 0;

  for (const section of ACCORDION_CONFIG) {
    for (const fieldEntry of section.fields) {
      const field = normalizeFieldConfig(fieldEntry);

      // Skip fields that don't exist in this schema
      if (!fieldExistsInSchema(field.path, variableSchema, rootSchema)) {
        continue;
      }

      // Check if field is required
      if (!isFieldRequired(field.path, variableSchema, rootSchema)) {
        continue;
      }

      // Check if field is missing
      const value = getNestedValue(variable, field.path);
      if (value === undefined || value === null || value === "") {
        missingCount++;
      }
    }
  }

  return missingCount;
}

/**
 * VariablesField - A custom RJSF field for managing dataset variables.
 * Renders as a bordered section with a table of variables and Add/Edit/Delete actions.
 * Integrates with VariableModal for adding and editing variables.
 */
const VariablesField: React.FC<FieldProps> = (props) => {
  const { formData, onChange, disabled, readonly, registry, fieldPathId } =
    props;

  // Get the root schema from RJSF registry
  const rootSchema = registry.rootSchema as JSONSchema;

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
      dataset_variable_name: `${(original.dataset_variable_name as string) || ""} (Copy)`
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
                        const missing = countMissingRequiredFields(variable, rootSchema);
                        if (missing > 0) {
                          return (
                            <Tooltip label={`${missing} required field${missing > 1 ? "s" : ""} missing`}>
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
        initialData={
          editingIndex !== null ? variables[editingIndex] : undefined
        }
        rootSchema={rootSchema}
      />
    </>
  );
};

export default VariablesField;
