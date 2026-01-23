"use client";

import React, { useState } from "react";
import {
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Group,
  Text,
  Tooltip,
  ActionIcon
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  getFieldMetadata,
  getNestedValue,
  setNestedValue,
  type JSONSchema,
  type FieldMetadata
} from "../schemaUtils";
import DescriptionModal from "../rjsf/DescriptionModal";
import { formatEnumTitle } from "@/utils/enumDecorator";

export interface SchemaFieldProps {
  /** Dot-separated path to the field (e.g., "analyzing_instrument.calibration.dye_purified") */
  fieldPath: string;
  /** The variable schema (e.g., DiscretePHVariable) */
  variableSchema: JSONSchema;
  /** The root schema containing $defs */
  rootSchema: JSONSchema;
  /** Current form data */
  formData: Record<string, unknown>;
  /** Callback when value changes */
  onChange: (newFormData: Record<string, unknown>) => void;
  /** Description display mode */
  descriptionMode?: "tooltip" | "modal" | "placeholder" | "none";
  /** Input type: "text" (single line) or "textarea" (multi-line). Default is "text" */
  inputType?: "text" | "textarea";
}

/**
 * Schema-driven field component that renders the appropriate input
 * based on the field's JSON Schema metadata.
 */
export default function SchemaField({
  fieldPath,
  variableSchema,
  rootSchema,
  formData,
  onChange,
  descriptionMode = "tooltip",
  inputType = "text"
}: SchemaFieldProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Get field metadata from schema
  const metadata = getFieldMetadata(fieldPath, variableSchema, rootSchema);

  if (!metadata) {
    console.warn(`SchemaField: No metadata found for path "${fieldPath}"`);
    return null;
  }

  const currentValue = getNestedValue(formData, fieldPath);

  const handleChange = (value: unknown) => {
    const newFormData = setNestedValue(formData, fieldPath, value);
    onChange(newFormData);
  };

  // Render the label with description tooltip/modal
  const renderLabel = () => {
    const { title, description, required } = metadata;

    // No description or mode is none
    if (!description || descriptionMode === "none") {
      return (
        <Text size="sm" fw={500}>
          {title} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
      );
    }

    // Placeholder mode - description goes in placeholder, not label
    if (descriptionMode === "placeholder") {
      return (
        <Text size="sm" fw={500}>
          {title} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
      );
    }

    // Modal mode
    if (descriptionMode === "modal") {
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

    // Default: tooltip mode
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
          style={{ wordWrap: "break-word" }}
        >
          <ActionIcon variant="transparent" size="xs" color="gray">
            <IconInfoCircle size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  };

  // Get placeholder text
  const getPlaceholder = () => {
    if (descriptionMode === "placeholder" && metadata.description) {
      return metadata.description;
    }
    return undefined;
  };

  // Render the appropriate input based on type
  return renderInput(
    metadata,
    currentValue,
    handleChange,
    renderLabel,
    getPlaceholder,
    inputType
  );
}

/**
 * Renders the appropriate input component based on field metadata.
 * Note: We don't pass `required` to Mantine components because we handle
 * the asterisk manually in renderLabel(). Mantine's `required` prop would
 * add a duplicate asterisk.
 */
function renderInput(
  metadata: FieldMetadata,
  currentValue: unknown,
  handleChange: (value: unknown) => void,
  renderLabel: () => React.ReactNode,
  getPlaceholder: () => string | undefined,
  inputType: "text" | "textarea"
) {
  const { type } = metadata;

  // Boolean fields -> Checkbox
  if (type === "boolean") {
    return (
      <Checkbox
        label={renderLabel()}
        checked={Boolean(currentValue)}
        onChange={(e) => handleChange(e.currentTarget.checked)}
      />
    );
  }

  // Enum fields -> Select
  if (type === "enum" || metadata.enum) {
    const options =
      metadata.enum?.map((value) => ({
        value: String(value),
        label: formatEnumTitle(String(value))
      })) || [];

    return (
      <Select
        label={renderLabel()}
        placeholder={getPlaceholder() || "Select an option"}
        data={options}
        value={currentValue ? String(currentValue) : null}
        onChange={(value) => handleChange(value)}
        clearable
      />
    );
  }

  // String fields with format
  if (metadata.format === "date-time") {
    // For now, render as text input with ISO format hint
    // Could enhance with DateTimePicker later
    return (
      <TextInput
        label={renderLabel()}
        placeholder={getPlaceholder() || "YYYY-MM-DDTHH:MM:SSZ"}
        value={String(currentValue || "")}
        onChange={(e) => handleChange(e.target.value)}
      />
    );
  }

  // Textarea for multi-line input
  if (inputType === "textarea") {
    return (
      <Textarea
        label={renderLabel()}
        placeholder={getPlaceholder()}
        value={String(currentValue || "")}
        onChange={(e) => handleChange(e.target.value)}
        autosize
        minRows={2}
        maxRows={6}
      />
    );
  }

  // Default: TextInput (single line)
  return (
    <TextInput
      label={renderLabel()}
      placeholder={getPlaceholder()}
      value={String(currentValue || "")}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}
