"use client";

import React, { useState } from "react";
import {
  Checkbox,
  TextInput,
  Group,
  Text,
  Tooltip,
  ActionIcon,
  Grid,
  Collapse
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  getFieldMetadata,
  getNestedValue,
  setNestedValue,
  type JSONSchema
} from "../schemaUtils";
import DescriptionModal from "../rjsf/DescriptionModal";

interface OptionalWithGateFieldProps {
  /** Dot-separated path to the field */
  fieldPath: string;
  /** The variable schema */
  variableSchema: JSONSchema;
  /** The root schema containing $defs */
  rootSchema: JSONSchema;
  /** Current form data */
  formData: Record<string, unknown>;
  /** Callback when value changes */
  onChange: (newFormData: Record<string, unknown>) => void;
  /** Show description in modal instead of tooltip */
  descriptionModal?: boolean;
  /** Placeholder text for the text input */
  placeholderText?: string;
  /** Label for the checkbox gate */
  gateLabel: string;
}

/**
 * Renders a checkbox gate with an associated text input field.
 * When checked, reveals a text input below.
 * Uses full-width layout to avoid checkbox/input alignment issues.
 */
export default function OptionalWithGateField({
  fieldPath,
  variableSchema,
  rootSchema,
  formData,
  onChange,
  descriptionModal = false,
  placeholderText,
  gateLabel
}: OptionalWithGateFieldProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Get metadata for the field
  const fieldMetadata = getFieldMetadata(fieldPath, variableSchema, rootSchema);

  if (!fieldMetadata) {
    console.warn(
      `OptionalWithGateField: No metadata found for path "${fieldPath}"`
    );
    return null;
  }

  const fieldValue = getNestedValue(formData, fieldPath) as string | undefined;

  // Gate state path - store in formData with _gate suffix
  const gateStatePath = `${fieldPath}_gate`;
  const gateValue = getNestedValue(formData, gateStatePath) as
    | boolean
    | undefined;

  const isChecked = gateValue === true;

  const handleGateChange = (checked: boolean) => {
    let newFormData = setNestedValue(formData, gateStatePath, checked);
    // Clear field value when unchecking
    if (!checked) {
      newFormData = setNestedValue(newFormData, fieldPath, undefined);
    }
    onChange(newFormData);
  };

  const handleFieldChange = (value: string) => {
    const newFormData = setNestedValue(formData, fieldPath, value || undefined);
    onChange(newFormData);
  };

  // Render label with description (tooltip or modal)
  const renderLabel = (
    title: string,
    description: string | undefined,
    required: boolean,
    useModal: boolean
  ) => {
    if (!description) {
      return (
        <Text size="sm" fw={500}>
          {title} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
      );
    }

    if (useModal) {
      return (
        <>
          <Group gap={4}>
            <Text size="sm" fw={500}>
              {title} {required && <span style={{ color: "red" }}>*</span>}
            </Text>
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

    // Default: tooltip
    return (
      <Group gap={4}>
        <Text size="sm" fw={500}>
          {title} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
        <Tooltip
          label={description}
          position="top"
          withArrow
          multiline
          maw={400}
        >
          <ActionIcon variant="transparent" size="xs" color="gray">
            <IconInfoCircle size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  };

  return (
    <>
      {/* Checkbox gate - full width row */}
      <Grid.Col span={12} pt={4} pb={0}>
        <Checkbox
          label={gateLabel}
          checked={isChecked}
          onChange={(e) => handleGateChange(e.currentTarget.checked)}
          radius={6}
          styles={{
            label: {
              fontSize: "var(--mantine-font-size-sm)"
            }
          }}
        />
      </Grid.Col>

      {/* Text Input - revealed when checked, with smooth animation */}
      <Grid.Col span={6} pt={isChecked ? undefined : 0}>
        <Collapse in={isChecked}>
          <TextInput
            label={renderLabel(
              fieldMetadata.title,
              fieldMetadata.description,
              fieldMetadata.required,
              descriptionModal
            )}
            placeholder={placeholderText || "Enter value"}
            value={fieldValue || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
          />
        </Collapse>
      </Grid.Col>
    </>
  );
}
