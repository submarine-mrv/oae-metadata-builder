"use client";

import { Select, TextInput, Grid } from "@mantine/core";
import {
  getFieldMetadata,
  getNestedValue,
  setNestedValue,
  type JSONSchema
} from "../schemaUtils";
import FieldLabel from "./FieldLabel";
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
 * The custom field is shown when the schema has a corresponding _custom field
 * AND the selected enum value matches "other" (case-insensitive).
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

  const descriptionMode = descriptionModal ? "modal" as const : "tooltip" as const;

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
          label={
            <FieldLabel
              title={enumMetadata.title}
              description={enumMetadata.description}
              required={enumMetadata.required}
              descriptionMode={descriptionMode}
            />
          }
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
            label={
              <FieldLabel
                title={customMetadata.title}
                description={customMetadata.description}
                required={customMetadata.required}
                descriptionMode={descriptionMode}
              />
            }
            placeholder="Please specify"
            value={customValue || ""}
            onChange={(e) => handleCustomChange(e.target.value)}
          />
        </Grid.Col>
      )}
    </>
  );
}
