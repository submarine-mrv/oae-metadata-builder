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

const ExternalProjectField: React.FC<FieldProps> = (props) => {
  const {
    formData = {},
    onChange,
    disabled,
    readonly,
    required,
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

  const createFieldProps = (fieldName: string, fieldSchema: any) => ({
    formData: formData[fieldName],
    onChange: (data: any) => handleFieldChange(fieldName, data.formData || data),
    disabled,
    readonly,
    required: false, // Override required for ExternalProject fields - they should be optional
    schema: fieldSchema,
    uiSchema: uiSchema?.[fieldName] || {},
    idSchema: { ...idSchema, $id: `${idSchema.$id}_${fieldName}` }
  });

  return (
    <Box>
      <Stack gap="md">
        {/* Name field */}
        {schema.properties?.name && (
          <Box>
            <Text size="sm" style={{ fontWeight: 500, marginBottom: "4px" }}>
              Name
            </Text>
            <TextInput
              value={formData.name || ""}
              onChange={(e) => handleFieldChange("name", e.currentTarget.value)}
              disabled={disabled || readonly}
              placeholder="Project name"
            />
          </Box>
        )}

        {/* Grid layout for temporal and spatial coverage */}
        {(schema.properties?.temporal_coverage ||
          schema.properties?.spatial_coverage) && (
          <Grid gutter="md">
            {/* Temporal coverage - left column */}
            {schema.properties?.temporal_coverage && (
              <Grid.Col span={6}>
                <Box>
                  <Text
                    size="sm"
                    style={{ fontWeight: 500, marginBottom: "8px" }}
                  >
                    Temporal Coverage
                  </Text>
                  <IsoIntervalWidgetVertical
                    {...createFieldProps(
                      "temporal_coverage",
                      schema.properties.temporal_coverage
                    )}
                  />
                </Box>
              </Grid.Col>
            )}

            {/* Spatial coverage - right column */}
            {schema.properties?.spatial_coverage && (
              <Grid.Col span={6}>
                <SpatialCoverageMiniMap
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
            <Text size="sm" style={{ fontWeight: 500, marginBottom: "4px" }}>
              Description
            </Text>
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
}

const RelatedLinksField: React.FC<RelatedLinksFieldProps> = ({
  value,
  onChange,
  disabled
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
      <Text size="sm" style={{ fontWeight: 500, marginBottom: "4px" }}>
        Related Links
      </Text>
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
