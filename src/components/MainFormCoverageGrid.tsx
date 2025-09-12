"use client";

import React from "react";
import type { FieldProps } from "@rjsf/utils";
import { Grid, Box, Text, TextInput, Stack } from "@mantine/core";
import IsoIntervalWidget from "./IsoIntervalWidget";
import SpatialCoverageMiniMap from "./SpatialCoverageMiniMap";

const MainFormCoverageGrid: React.FC<FieldProps> = (props) => {
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
    required: schema.required?.includes(fieldName),
    schema: fieldSchema,
    uiSchema: uiSchema?.[fieldName] || {},
    idSchema: { ...idSchema, $id: `${idSchema.$id}_${fieldName}` }
  });

  return (
    <Grid gutter="md">
        {/* Left column - Temporal and Vertical Coverage */}
        <Grid.Col span={6}>
          <Stack gap="md">
            {/* Temporal Coverage */}
            {schema.properties?.temporal_coverage && (
              <IsoIntervalWidget
                {...createFieldProps('temporal_coverage', schema.properties.temporal_coverage)}
              />
            )}

            {/* Vertical Coverage */}
            {schema.properties?.vertical_coverage && (
              <Grid gutter="sm">
                <Grid.Col span={6}>
                  <TextInput
                    label="Min Depth (m)"
                    type="number"
                    value={formData.vertical_coverage?.min_depth_in_m || ''}
                    onChange={(e) => {
                      const newValue = e.currentTarget.value;
                      const currentVertical = formData.vertical_coverage || {};
                      handleFieldChange('vertical_coverage', {
                        ...currentVertical,
                        min_depth_in_m: newValue ? Number(newValue) : undefined
                      });
                    }}
                    disabled={disabled || readonly}
                    placeholder="0"
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Max Depth (m)"
                    type="number"
                    value={formData.vertical_coverage?.max_depth_in_m || ''}
                    onChange={(e) => {
                      const newValue = e.currentTarget.value;
                      const currentVertical = formData.vertical_coverage || {};
                      handleFieldChange('vertical_coverage', {
                        ...currentVertical,
                        max_depth_in_m: newValue ? Number(newValue) : undefined
                      });
                    }}
                    disabled={disabled || readonly}
                    placeholder="50"
                  />
                </Grid.Col>
              </Grid>
            )}
          </Stack>
        </Grid.Col>
        
        {/* Right column - Spatial Coverage */}
        {schema.properties?.spatial_coverage && (
          <Grid.Col span={6}>
            <SpatialCoverageMiniMap
              {...createFieldProps('spatial_coverage', schema.properties.spatial_coverage)}
            />
          </Grid.Col>
        )}
      </Grid>
  );
};

export default MainFormCoverageGrid;