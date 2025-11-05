"use client";

import React from "react";
import type { FieldProps } from "@rjsf/utils";
import { Box, Stack, Select, NumberInput, Text, Group } from "@mantine/core";
import schema from "../../../public/experiment.schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";
import FieldLabel, { FieldLabelSmall } from "./FieldLabel";

// Generate formatted enum names for mass concentration units
const enumNames = generateEnumNames(schema, ["MassConcentrationUnit"]);

const nestedItemStyle = {
  border: "1px solid #ccc",
  borderRadius: "5px",
  padding: "16px",
  margin: "8px 0",
  background: "#f9f9f9"
};

/**
 * Custom field for DosingConcentration object
 * Handles calculation method, value type, amount, and unit with conditional rendering
 */
const DosingConcentrationField: React.FC<FieldProps> = (props) => {
  const {
    formData = {},
    onChange,
    disabled,
    readonly,
    schema: fieldSchema,
    uiSchema
  } = props;

  // Get DosingConcentration schema definition
  const dosingConcentrationSchema =
    (schema as any).$defs?.DosingConcentration || {};
  const properties = dosingConcentrationSchema.properties || {};
  const requiredFields = dosingConcentrationSchema.required || [];

  // Check if description modal is enabled in uiSchema
  const useModal = uiSchema?.["ui:descriptionModal"] === true;

  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...formData,
      [fieldName]: value
    });
  };

  // Determine if fields should be disabled (when value is variable/provided as file)
  const isVariable = formData.is_provided_as_a_file === true;

  // Get field title and description from parent schema
  const fieldTitle = fieldSchema?.title || "Dosing Concentration";
  const fieldDescription = fieldSchema?.description;

  return (
    <>
      {/* Field Title - outside the grey box */}
      <FieldLabel
        label={fieldTitle}
        description={fieldDescription}
        useModal={useModal}
        order={5}
      />

      <Box style={nestedItemStyle}>
        <Stack gap="md">
          {/* Calculation Method - is_derived_value */}
          <Box>
            <FieldLabelSmall
              label="Calculation Method"
              description={properties.is_derived_value?.description}
              required={requiredFields.includes("is_derived_value")}
              useModal={useModal}
            />
            <Select
              value={
                formData.is_derived_value === true
                  ? "derived"
                  : formData.is_derived_value === false
                    ? "measured"
                    : null
              }
              onChange={(value) => {
                handleFieldChange("is_derived_value", value === "derived");
              }}
              data={[
                { value: "measured", label: "Measured Directly" },
                { value: "derived", label: "Derived Value" }
              ]}
              disabled={disabled || readonly}
            />
          </Box>

          {/* Value Type - is_provided_as_a_file */}
          <Box>
            <FieldLabelSmall
              label={
                "Is " + fieldTitle.toLowerCase() + " a fixed value or variable?"
              }
              description={properties.is_provided_as_a_file?.description}
              required={requiredFields.includes("is_provided_as_a_file")}
              useModal={useModal}
            />
            <Select
              value={
                formData.is_provided_as_a_file === true
                  ? "variable"
                  : formData.is_provided_as_a_file === false
                    ? "fixed"
                    : null
              }
              onChange={(value) => {
                handleFieldChange(
                  "is_provided_as_a_file",
                  value === "variable"
                );
              }}
              data={[
                { value: "fixed", label: "Fixed Value" },
                { value: "variable", label: "Variable" }
              ]}
              disabled={disabled || readonly}
            />
          </Box>

          {/* Amount and Unit - side by side */}
          <Group gap="md" align="flex-start" grow>
            <NumberInput
              label="Amount"
              value={formData.amount ?? ""}
              onChange={(value) => handleFieldChange("amount", value)}
              disabled={disabled || readonly || isVariable}
              placeholder={isVariable ? "Provided in file" : "Enter amount"}
              decimalScale={6}
            />
            <Select
              label="Unit"
              value={formData.unit ?? null}
              onChange={(value) => handleFieldChange("unit", value)}
              data={
                (schema as any).$defs?.MassConcentrationUnit?.enum?.map(
                  (unit: string, index: number) => ({
                    value: unit,
                    label: enumNames.MassConcentrationUnit[index]
                  })
                ) || []
              }
              disabled={disabled || readonly || isVariable}
              placeholder={isVariable ? "Provided in file" : "Select unit"}
              searchable
              required={requiredFields.includes("unit")}
              withAsterisk={requiredFields.includes("unit")}
            />
          </Group>

          {/* Informational text for variable values */}
          {isVariable && (
            <Text size="sm" c="dimmed" style={{ fontStyle: "italic" }}>
              Variable effluent densities should be provided separately in the
              dosing file, using the field names specified in the dosing data
              template.
            </Text>
          )}
        </Stack>
      </Box>
    </>
  );
};

export default DosingConcentrationField;
