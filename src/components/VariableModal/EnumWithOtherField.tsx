"use client";

import React, { useState } from "react";
import {
  Select,
  TextInput,
  Group,
  Text,
  Tooltip,
  ActionIcon,
  Grid
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  getFieldMetadata,
  getNestedValue,
  setNestedValue,
  type JSONSchema
} from "../schemaUtils";
import DescriptionModal from "../rjsf/DescriptionModal";
import { formatEnumTitle } from "@/utils/enumDecorator";

interface EnumWithOtherFieldProps {
  /** Dot-separated path to the enum field */
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
  /** Placeholder text for the enum select */
  placeholderText?: string;
}

/**
 * Renders an enum field with an associated _custom text field.
 * The custom field is only shown when "other" (case-insensitive) is selected.
 * Both fields render at span 6 within the parent Grid.
 */
export default function EnumWithOtherField({
  fieldPath,
  variableSchema,
  rootSchema,
  formData,
  onChange,
  descriptionModal = false,
  placeholderText
}: EnumWithOtherFieldProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Get metadata for the enum field
  const enumMetadata = getFieldMetadata(fieldPath, variableSchema, rootSchema);
  const customFieldPath = `${fieldPath}_custom`;
  const customMetadata = getFieldMetadata(
    customFieldPath,
    variableSchema,
    rootSchema
  );

  if (!enumMetadata) {
    console.warn(
      `EnumWithOtherField: No metadata found for path "${fieldPath}"`
    );
    return null;
  }

  const enumValue = getNestedValue(formData, fieldPath) as string | undefined;
  const customValue = getNestedValue(formData, customFieldPath) as
    | string
    | undefined;

  // Check if "other" is selected (case-insensitive)
  const isOtherSelected =
    enumValue?.toLowerCase() === "other" ||
    enumValue?.toLowerCase() === "other (please specify)";

  const handleEnumChange = (value: string | null) => {
    let newFormData = setNestedValue(formData, fieldPath, value);
    // Clear custom field when switching away from "other"
    if (!value || value.toLowerCase() !== "other") {
      newFormData = setNestedValue(newFormData, customFieldPath, undefined);
    }
    onChange(newFormData);
  };

  const handleCustomChange = (value: string) => {
    const newFormData = setNestedValue(formData, customFieldPath, value);
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

  // Build enum options
  const enumOptions =
    enumMetadata.enum?.map((value) => ({
      value: String(value),
      label: formatEnumTitle(String(value))
    })) || [];

  return (
    <>
      {/* Enum Select - always visible */}
      <Grid.Col span={6}>
        <Select
          label={renderLabel(
            enumMetadata.title,
            enumMetadata.description,
            enumMetadata.required,
            descriptionModal
          )}
          placeholder={placeholderText || "Select an option"}
          data={enumOptions}
          value={enumValue || null}
          onChange={handleEnumChange}
          clearable
        />
      </Grid.Col>

      {/* Custom Text Input - always reserve space when schema has _custom field */}
      {customMetadata && (
        <Grid.Col span={6} style={{ visibility: isOtherSelected ? "visible" : "hidden" }}>
          <TextInput
            label={renderLabel(
              customMetadata.title,
              customMetadata.description,
              customMetadata.required,
              descriptionModal
            )}
            placeholder="Please specify"
            value={customValue || ""}
            onChange={(e) => handleCustomChange(e.target.value)}
          />
        </Grid.Col>
      )}
    </>
  );
}
