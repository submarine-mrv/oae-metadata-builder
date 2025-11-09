"use client";

import React, { useState, useEffect } from "react";
import type { WidgetProps } from "@rjsf/utils";
import { Stack, Select, NumberInput, Text, Box } from "@mantine/core";
import { FieldLabelSmall } from "./FieldLabel";

/**
 * Custom widget for dosing_depth field
 * Handles fixed numeric depth vs variable depth with file provision
 */
const DosingDepthWidget: React.FC<WidgetProps> = ({
  id,
  value,
  onChange,
  required,
  disabled,
  readonly,
  label,
  schema,
  uiSchema
}) => {
  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true;

  // Determine initial state from value
  const getInitialState = () => {
    if (!value) return { isVariable: false, numericValue: "" };

    // If value is "variable" or contains "variable", treat as variable
    if (typeof value === "string" && value.toLowerCase().includes("variable")) {
      return { isVariable: true, numericValue: "" };
    }

    // Otherwise, treat as fixed numeric value
    return { isVariable: false, numericValue: value };
  };

  const [state, setState] = useState(getInitialState);

  // Update state when external value changes
  useEffect(() => {
    const newState = getInitialState();
    setState(newState);
  }, [value]);

  const handleVariabilityChange = (newValue: string | null) => {
    const isVariable = newValue === "variable";
    setState({ isVariable, numericValue: isVariable ? "" : state.numericValue });

    if (isVariable) {
      onChange("Variable - provided in file");
    } else {
      // If switching to fixed, clear the value so user must enter it
      onChange(undefined);
    }
  };

  const handleDepthChange = (newValue: number | string) => {
    const strValue = newValue === "" ? "" : String(newValue);
    setState({ ...state, numericValue: strValue });
    onChange(strValue || undefined);
  };

  return (
    <Stack gap="md">
      {/* Variability selector */}
      <Box>
        <FieldLabelSmall
          label="Is dosing depth a fixed value or variable?"
          useModal={false}
          required={required}
        />
        <Select
          value={state.isVariable ? "variable" : "fixed"}
          onChange={handleVariabilityChange}
          data={[
            { value: "fixed", label: "Fixed Value" },
            { value: "variable", label: "Variable" }
          ]}
          disabled={disabled || readonly}
        />
      </Box>

      {/* Depth input */}
      <Box>
        <FieldLabelSmall
          label="Dosing Depth (in meters)"
          description={description}
          useModal={useModal}
          required={!state.isVariable && required}
        />
        <NumberInput
          id={id}
          value={state.isVariable ? "" : state.numericValue}
          onChange={handleDepthChange}
          disabled={disabled || readonly || state.isVariable}
          placeholder={
            state.isVariable ? "Provided in file" : "Enter depth in meters"
          }
          decimalScale={2}
          min={0}
        />
      </Box>

      {/* Informational text for variable values */}
      {state.isVariable && (
        <Text size="sm" c="dimmed" style={{ fontStyle: "italic" }}>
          Variable dosing depths should be provided separately in the dosing
          file, using the field names specified in the dosing data template.
        </Text>
      )}
    </Stack>
  );
};

export default DosingDepthWidget;
