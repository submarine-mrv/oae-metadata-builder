// PlaceholderField.tsx - Placeholder for complex object fields not yet fully implemented
import React from "react";
import { Box, Text } from "@mantine/core";
import type { FieldProps } from "@rjsf/utils";

const PlaceholderField: React.FC<FieldProps> = (props) => {
  const { schema } = props;
  const label = schema.title || props.name;

  return (
    <Box mb="md">
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
        </Text>
      )}
      <Box
        p="md"
        style={{
          backgroundColor: "#f1f3f5",
          border: "1px solid #dee2e6",
          borderRadius: "4px"
        }}
      >
        <Text size="sm" c="dimmed" ta="center">
          TBD / Incomplete
        </Text>
      </Box>
    </Box>
  );
};

export default PlaceholderField;