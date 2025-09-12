"use client";

import React from "react";
import type { FieldProps } from "@rjsf/utils";
import { Text, Grid, TextInput } from "@mantine/core";

const VerticalCoverageField: React.FC<FieldProps> = (props) => {
  const {
    formData = {},
    onChange,
    disabled,
    readonly,
    required,
    schema,
    uiSchema
  } = props;

  const label = uiSchema?.["ui:title"] ?? schema?.title ?? "Vertical Coverage";

  const handleFieldChange = (field: string, value: string) => {
    const newValue = value ? Number(value) : undefined;
    onChange({
      ...formData,
      [field]: newValue
    });
  };

  return (
    <div>
      <Text size="sm" fw={500} mb="xs">
        {label} {required && <Text component="span" c="red">*</Text>}
      </Text>
      <Grid gutter="sm">
        <Grid.Col span={6}>
          <TextInput
            label="Min Depth (m)"
            type="number"
            value={formData.min_depth_in_m || ''}
            onChange={(e) => handleFieldChange('min_depth_in_m', e.currentTarget.value)}
            disabled={disabled || readonly}
            placeholder="e.g., 0"
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Max Depth (m)"
            type="number"
            value={formData.max_depth_in_m || ''}
            onChange={(e) => handleFieldChange('max_depth_in_m', e.currentTarget.value)}
            disabled={disabled || readonly}
            placeholder="e.g., 50"
          />
        </Grid.Col>
      </Grid>
    </div>
  );
};

export default VerticalCoverageField;