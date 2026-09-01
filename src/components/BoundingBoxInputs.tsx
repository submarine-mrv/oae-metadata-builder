import { Box, Group, NumberInput, Stack, Text } from "@mantine/core";
import type React from "react";
import { MAX_LATITUDE, MAX_LONGITUDE, MIN_LATITUDE, MIN_LONGITUDE } from "@/utils/spatialUtils";

export type BoxEdge = "north" | "south" | "east" | "west";

/**
 * Labels name the edge and give its range, rather than a compass letter.
 * "°S (min latitude)" reads as though the southern edge must be below the
 * equator, which is wrong for a box spanning 45°N to 55°N.
 */
const EDGE_LABELS: Record<BoxEdge, string> = {
  north: `Max latitude (${MIN_LATITUDE}° to ${MAX_LATITUDE}°)`,
  south: `Min latitude (${MIN_LATITUDE}° to ${MAX_LATITUDE}°)`,
  east: `East edge (${MIN_LONGITUDE}° to ${MAX_LONGITUDE}°)`,
  west: `West edge (${MIN_LONGITUDE}° to ${MAX_LONGITUDE}°)`,
};

const EDGE_PLACEHOLDERS: Record<BoxEdge, string> = {
  north: "e.g., 47.8",
  south: "e.g., 47.2",
  east: "e.g., -122.0",
  west: "e.g., -123.5",
};

type CoordValue = number | string;

interface BoundingBoxInputsProps {
  north: CoordValue;
  south: CoordValue;
  east: CoordValue;
  west: CoordValue;
  onChange: (edge: BoxEdge, value: CoordValue) => void;
  /** Marks both latitude inputs red and shows the message below them. */
  latitudeError?: boolean;
  /**
   * "rows" pairs each latitude with a longitude on its own line; "columns" puts
   * both latitudes in one column and both longitudes in another.
   */
  layout?: "rows" | "columns";
  disabled?: boolean;
}

const LATITUDE_ERROR = "North latitude must be greater than South latitude";

const BoundingBoxInputs: React.FC<BoundingBoxInputsProps> = ({
  north,
  south,
  east,
  west,
  onChange,
  latitudeError = false,
  layout = "rows",
  disabled,
}) => {
  const values: Record<BoxEdge, CoordValue> = { north, south, east, west };

  const input = (edge: BoxEdge) => {
    const isLatitude = edge === "north" || edge === "south";
    return (
      <NumberInput
        label={EDGE_LABELS[edge]}
        placeholder={EDGE_PLACEHOLDERS[edge]}
        value={values[edge]}
        onChange={(value) => onChange(edge, value)}
        min={isLatitude ? MIN_LATITUDE : MIN_LONGITUDE}
        max={isLatitude ? MAX_LATITUDE : MAX_LONGITUDE}
        decimalScale={6}
        size="sm"
        style={{ width: "200px" }}
        error={isLatitude ? latitudeError : undefined}
        disabled={disabled}
      />
    );
  };

  const errorText = latitudeError ? (
    <Text size="xs" c="red" mt={4}>
      {LATITUDE_ERROR}
    </Text>
  ) : null;

  if (layout === "columns") {
    return (
      <Box>
        <Group gap="md" align="flex-start" justify="center">
          <Stack gap="xs">
            {input("north")}
            {input("south")}
          </Stack>
          <Stack gap="xs">
            {input("east")}
            {input("west")}
          </Stack>
        </Group>
        {errorText}
      </Box>
    );
  }

  return (
    <Stack gap="xs" align="center">
      <Group gap="md" align="flex-start" justify="center">
        {input("north")}
        {input("east")}
      </Group>
      <Box>
        <Group gap="md" align="flex-start" justify="center">
          {input("south")}
          {input("west")}
        </Group>
        {errorText}
      </Box>
    </Stack>
  );
};

export default BoundingBoxInputs;
