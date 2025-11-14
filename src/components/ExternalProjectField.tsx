"use client";

import React from "react";
import type { FieldProps } from "@rjsf/utils";
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
import SpatialCoverageMiniMap from "./SpatialCoverageMiniMap";
import { FieldLabelSmall } from "./rjsf/FieldLabel";

const ExternalProjectField: React.FC<FieldProps> = (props) => {
  const {
    formData = {},
    onChange,
    disabled,
    readonly,
    schema,
    uiSchema,
    idSchema
  } = props;

  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...formData,
      [fieldName]: value
    });
  };
  const createWidgetProps = (fieldName: string, fieldSchema: any) => ({
    id: `${idSchema.$id}_${fieldName}`,
    name: fieldName,
    value: formData[fieldName],
    formData: formData[fieldName],
    onChange: (data: any) =>
      handleFieldChange(fieldName, data.formData || data),
    onBlur: () => {}, // No-op function for blur events
    onFocus: () => {}, // No-op function for focus events
    disabled,
    readonly,
    required: schema.required?.includes(fieldName) || false, // Check if field is required in schema
    schema: fieldSchema,
    uiSchema: uiSchema?.[fieldName] || {},
    idSchema: { ...idSchema, $id: `${idSchema.$id}_${fieldName}` },
    options: {},
    label: fieldName,
    placeholder: "",
    rawErrors: [],
    registry: props.registry // Pass through the registry from props
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
                    value={formData.name || ""}
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
                <SpatialCoverageMiniMap
                  {...createWidgetProps(
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
              value={formData.description || ""}
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
            value={formData.related_links || []}
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
