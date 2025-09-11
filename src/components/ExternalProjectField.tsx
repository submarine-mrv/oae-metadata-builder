"use client";

import React from "react";
import type { FieldProps } from "@rjsf/utils";
import { Grid, Box, Text, TextInput, Textarea, Stack } from "@mantine/core";
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
    onChange: (value: any) => handleFieldChange(fieldName, value),
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
            <Text size="sm" style={{ fontWeight: 500, marginBottom: '4px' }}>
              Name
            </Text>
            <TextInput
              value={formData.name || ''}
              onChange={(e) => handleFieldChange('name', e.currentTarget.value)}
              disabled={disabled || readonly}
              placeholder="Project name"
            />
          </Box>
        )}

        {/* Grid layout for temporal and spatial coverage */}
        {(schema.properties?.temporal_coverage || schema.properties?.spatial_coverage) && (
          <Grid gutter="md">
            {/* Temporal coverage - left column */}
            {schema.properties?.temporal_coverage && (
              <Grid.Col span={6}>
                <Box>
                  <Text size="sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
                    Temporal Coverage
                  </Text>
                  <IsoIntervalWidgetVertical
                    {...createFieldProps('temporal_coverage', schema.properties.temporal_coverage)}
                  />
                </Box>
              </Grid.Col>
            )}
            
            {/* Spatial coverage - right column */}
            {schema.properties?.spatial_coverage && (
              <Grid.Col span={6}>
                <SpatialCoverageMiniMap
                  {...createFieldProps('spatial_coverage', schema.properties.spatial_coverage)}
                />
              </Grid.Col>
            )}
          </Grid>
        )}

        {/* Description field */}
        {schema.properties?.description && (
          <Box>
            <Text size="sm" style={{ fontWeight: 500, marginBottom: '4px' }}>
              Description
            </Text>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => handleFieldChange('description', e.currentTarget.value)}
              disabled={disabled || readonly}
              placeholder="Project description"
              rows={3}
            />
          </Box>
        )}

        {/* Related links field */}
        {schema.properties?.related_links && (
          <Box>
            <Text size="sm" style={{ fontWeight: 500, marginBottom: '4px' }}>
              Related Links
            </Text>
            {/* Simple text input for now - can enhance later */}
            <TextInput
              value={Array.isArray(formData.related_links) ? formData.related_links.join(', ') : ''}
              onChange={(e) => {
                const links = e.currentTarget.value.split(',').map(link => link.trim()).filter(Boolean);
                handleFieldChange('related_links', links);
              }}
              disabled={disabled || readonly}
              placeholder="https://example.com, https://another.com (comma-separated)"
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default ExternalProjectField;