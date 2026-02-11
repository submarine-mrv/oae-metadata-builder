"use client";

import React, { useState } from "react";
import {
  Checkbox,
  TextInput,
  Grid,
  Collapse
} from "@mantine/core";
import {
  getFieldMetadata,
  getNestedValue,
  setNestedValue,
  type JSONSchema
} from "../schemaUtils";
import FieldLabel from "./FieldLabel";

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
 *
 * Gate state is derived from whether the field has a value, not stored
 * separately in form data — avoids polluting the data model with UI concerns.
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
  // Get metadata for the field
  const fieldMetadata = getFieldMetadata(fieldPath, variableSchema, rootSchema);

  // Local UI state for the gate checkbox — not persisted in form data
  // Initialize as checked if there's already a value for this field
  const fieldValue = getNestedValue(formData, fieldPath) as string | undefined;
  const [isChecked, setIsChecked] = useState(!!fieldValue);

  if (!fieldMetadata) {
    console.warn(
      `OptionalWithGateField: No metadata found for path "${fieldPath}"`
    );
    return null;
  }

  const handleGateChange = (checked: boolean) => {
    setIsChecked(checked);
    // Clear field value when unchecking
    if (!checked) {
      const newFormData = setNestedValue(formData, fieldPath, undefined);
      onChange(newFormData);
    }
  };

  const handleFieldChange = (value: string) => {
    const newFormData = setNestedValue(formData, fieldPath, value || undefined);
    onChange(newFormData);
  };

  const descriptionMode = descriptionModal ? "modal" as const : "tooltip" as const;

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
            label={
              <FieldLabel
                title={fieldMetadata.title}
                description={fieldMetadata.description}
                required={fieldMetadata.required}
                descriptionMode={descriptionMode}
              />
            }
            placeholder={placeholderText || "Enter value"}
            value={fieldValue || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
          />
        </Collapse>
      </Grid.Col>
    </>
  );
}
