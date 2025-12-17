"use client";

import React from "react";
import type { FieldProps, FieldPathList } from "@rjsf/utils";
import {
  Grid,
  Box,
  Text,
  TextInput,
  Textarea,
  Stack,
  PillsInput,
  Pill
} from "@mantine/core";
import IsoIntervalWidgetVertical from "./IsoIntervalWidgetVertical";
import SpatialCoverageField from "./SpatialCoverageField";
import { FieldLabelSmall } from "./rjsf/FieldLabel";

const ExternalProjectField: React.FC<FieldProps> = (props) => {
  const {
    formData,
    onChange,
    disabled,
    readonly,
    schema,
    uiSchema,
    fieldPathId
  } = props;

  // Handle null/undefined formData
  const data = formData || {};

  const handleFieldChange = (fieldName: string, value: any) => {
    // For a custom Field managing a complex object, we merge the changes ourselves
    const updatedData = {
      ...data,
      [fieldName]: value
    };

    // v6 onChange: pass merged data with absolute path to this field
    onChange(updatedData, fieldPathId.path, undefined, fieldPathId.$id);
  };
  // Helper for creating props for custom widgets (WidgetProps)
  const createWidgetProps = (fieldName: string, fieldSchema: any) => ({
    id: `${fieldPathId.$id}_${fieldName}`,
    name: fieldName,
    value: data[fieldName],
    formData: data[fieldName],
    onChange: (widgetData: any) =>
      handleFieldChange(fieldName, widgetData.formData || widgetData),
    onBlur: () => {},
    onFocus: () => {},
    disabled,
    readonly,
    required: schema.required?.includes(fieldName) || false,
    schema: fieldSchema,
    uiSchema: uiSchema?.[fieldName] || {},
    options: {},
    label: fieldName,
    placeholder: "",
    rawErrors: [],
    registry: props.registry
  });

  // Helper for creating props for custom fields (FieldProps)
  const createFieldProps = (fieldName: string, fieldSchema: any) => ({
    id: `${fieldPathId.$id}_${fieldName}`,
    name: fieldName,
    value: data[fieldName],
    formData: data[fieldName],
    onChange: (fieldData: any) => handleFieldChange(fieldName, fieldData),
    onBlur: () => {},
    onFocus: () => {},
    disabled,
    readonly,
    required: schema.required?.includes(fieldName) || false,
    schema: fieldSchema,
    uiSchema: uiSchema?.[fieldName] || {},
    fieldPathId: {
      $id: `${fieldPathId.$id}_${fieldName}`,
      path: [...fieldPathId.path, fieldName]
    },
    options: {},
    label: fieldName,
    placeholder: "",
    rawErrors: [],
    registry: props.registry
  });

  return (
    <Box>
      <Stack gap="md">
        {/* Grid layout for name, temporal and spatial coverage */}
        {(schema.properties?.name ||
          schema.properties?.temporal_coverage ||
          schema.properties?.spatial_coverage) && (
          <Grid gutter="md">
            {/* Left column - Name and Temporal coverage */}
            <Grid.Col span={6}>
              {/* Name field */}
              {schema.properties?.name && (
                <Box mb="md">
                  <FieldLabelSmall
                    label="Name"
                    description={
                      typeof schema.properties.name === "object"
                        ? schema.properties.name.description
                        : undefined
                    }
                    required={schema.required?.includes("name")}
                  />
                  <TextInput
                    value={data.name || ""}
                    onChange={(e) =>
                      handleFieldChange("name", e.currentTarget.value)
                    }
                    disabled={disabled || readonly}
                    placeholder="Project name"
                  />
                </Box>
              )}

              {/* Temporal coverage */}
              {schema.properties?.temporal_coverage && (
                <IsoIntervalWidgetVertical
                  {...createWidgetProps(
                    "temporal_coverage",
                    schema.properties.temporal_coverage
                  )}
                />
              )}
            </Grid.Col>

            {/* Right column - Spatial coverage */}
            {schema.properties?.spatial_coverage && (
              <Grid.Col span={6}>
                <SpatialCoverageField
                  {...createFieldProps(
                    "spatial_coverage",
                    schema.properties.spatial_coverage
                  )}
                />
              </Grid.Col>
            )}
          </Grid>
        )}

        {/* Description field */}
        {schema.properties?.description && (
          <Box>
            <FieldLabelSmall
              label="Description"
              description={
                typeof schema.properties.description === "object"
                  ? schema.properties.description.description
                  : undefined
              }
              required={schema.required?.includes("description")}
            />
            <Textarea
              value={data.description || ""}
              onChange={(e) =>
                handleFieldChange("description", e.currentTarget.value)
              }
              disabled={disabled || readonly}
              placeholder="Project description"
              rows={3}
            />
          </Box>
        )}

        {/* Related links field */}
        {schema.properties?.related_links && (
          <RelatedLinksField
            value={data.related_links || []}
            onChange={(links) => handleFieldChange("related_links", links)}
            disabled={disabled || readonly}
            description={
              typeof schema.properties.related_links === "object"
                ? schema.properties.related_links.description
                : undefined
            }
            required={schema.required?.includes("related_links")}
          />
        )}
      </Stack>
    </Box>
  );
};

// Related Links Pills Component
interface RelatedLinksFieldProps {
  value: string[];
  onChange: (links: string[]) => void;
  disabled?: boolean;
  description?: string;
  required?: boolean;
}

const RelatedLinksField: React.FC<RelatedLinksFieldProps> = ({
  value,
  onChange,
  disabled,
  description,
  required = false
}) => {
  const [search, setSearch] = React.useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const link = search.trim();
      if (link && !value.includes(link)) {
        onChange([...value, link]);
        setSearch("");
      }
    } else if (
      e.key === "Backspace" &&
      search.length === 0 &&
      value.length > 0
    ) {
      onChange(value.slice(0, -1));
    }
  };

  const handleRemove = (linkToRemove: string) => {
    onChange(value.filter((link) => link !== linkToRemove));
  };

  return (
    <Box>
      <FieldLabelSmall
        label="Related Links"
        description={description}
        required={required}
      />
      <PillsInput>
        <Pill.Group>
          {value.map((link, index) => (
            <Pill
              key={index}
              withRemoveButton
              onRemove={() => !disabled && handleRemove(link)}
            >
              {link}
            </Pill>
          ))}
          <PillsInput.Field
            placeholder="Type URL and press Enter or comma..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
        </Pill.Group>
      </PillsInput>
    </Box>
  );
};

export default ExternalProjectField;
