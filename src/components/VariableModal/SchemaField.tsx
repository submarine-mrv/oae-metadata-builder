"use client";

import React from "react";
import {
  TextInput,
  Textarea,
  Select,
  Checkbox
} from "@mantine/core";
import {
  getFieldMetadata,
  getNestedValue,
  setNestedValue,
  type JSONSchema,
  type FieldMetadata
} from "../schemaUtils";
import FieldLabel, { type DescriptionMode } from "./FieldLabel";
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
  descriptionMode?: DescriptionMode;
  /** Input type: "text", "textarea", or "boolean_select" (Yes/No dropdown). Default is "text" */
  inputType?: "text" | "textarea" | "boolean_select";
  /** Custom placeholder text (overrides schema description in placeholder mode) */
  placeholderText?: string;
  /** Number of rows for textarea inputs */
  rows?: number;
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
  inputType = "text",
  placeholderText,
  rows
}: SchemaFieldProps) {
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

  const label = (
    <FieldLabel
      title={metadata.title}
      description={metadata.description}
      required={metadata.required}
      descriptionMode={descriptionMode}
    />
  );

  // Get placeholder text
  const getPlaceholder = () => {
    if (placeholderText) return placeholderText;
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
    label,
    getPlaceholder,
    inputType,
    rows
  );
}

/**
 * Renders the appropriate input component based on field metadata.
 * Note: We don't pass `required` to Mantine components because we handle
 * the asterisk manually in FieldLabel. Mantine's `required` prop would
 * add a duplicate asterisk.
 */
function renderInput(
  metadata: FieldMetadata,
  currentValue: unknown,
  handleChange: (value: unknown) => void,
  label: React.ReactNode,
  getPlaceholder: () => string | undefined,
  inputType: "text" | "textarea" | "boolean_select",
  rows?: number
) {
  const { type } = metadata;

  // Boolean fields as Yes/No dropdown
  if (type === "boolean" && inputType === "boolean_select") {
    const boolValue = currentValue === true ? "yes" : currentValue === false ? "no" : null;
    return (
      <Select
        label={label}
        placeholder={getPlaceholder() || "Select an option"}
        data={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" }
        ]}
        value={boolValue}
        onChange={(value) => handleChange(value === "yes" ? true : value === "no" ? false : null)}
        clearable
      />
    );
  }

  // Boolean fields -> Checkbox (default)
  if (type === "boolean") {
    return (
      <Checkbox
        label={label}
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
        label={label}
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
        label={label}
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
        label={label}
        placeholder={getPlaceholder()}
        value={String(currentValue || "")}
        onChange={(e) => handleChange(e.target.value)}
        autosize={!rows}
        minRows={rows || 2}
        maxRows={rows || 6}
      />
    );
  }

  // Default: TextInput (single line)
  return (
    <TextInput
      label={label}
      placeholder={getPlaceholder()}
      value={String(currentValue || "")}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}
