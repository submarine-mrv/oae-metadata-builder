// PlaceholderWidget.tsx - Placeholder for fields not yet fully implemented
import React from "react";
import { Box, Text } from "@mantine/core";
import type { WidgetProps } from "@rjsf/utils";

const PlaceholderWidget: React.FC<WidgetProps> = (props) => {
  const { label } = props;

  return (
    <Box>
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

export default PlaceholderWidget;