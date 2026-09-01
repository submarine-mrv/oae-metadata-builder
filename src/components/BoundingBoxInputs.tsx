import { Box, NumberInput, Text } from "@mantine/core";
import type React from "react";
import { MAX_LATITUDE, MAX_LONGITUDE, MIN_LATITUDE, MIN_LONGITUDE } from "@/utils/spatialUtils";

export type BoxEdge = "north" | "south" | "east" | "west";

/**
 * Compass letters beside each input, arranged as a compass rose (N on top,
 * W and E either side, S below), after NASA's ocean data order form. Position
 * says which edge each box is; the letter no longer has to imply a hemisphere,
 * which is what made "°S (min latitude)" misleading for a box at 45°N to 55°N.
 */
const EDGE_LETTERS: Record<BoxEdge, string> = {
  north: "N:",
  south: "S:",
  east: "E:",
  west: "W:",
};

/** Accessible names: the visible letter alone is not a useful screen-reader label. */
const EDGE_ARIA_LABELS: Record<BoxEdge, string> = {
  north: "North edge",
  south: "South edge",
  east: "East edge",
  west: "West edge",
};

/** The extreme of each edge, so the hint doubles as the allowed range. */
const EDGE_PLACEHOLDERS: Record<BoxEdge, string> = {
  north: String(MAX_LATITUDE),
  south: String(MIN_LATITUDE),
  east: String(MAX_LONGITUDE),
  west: String(MIN_LONGITUDE),
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
  disabled?: boolean;
}

const LATITUDE_ERROR = "North latitude must be greater than South latitude";
const RANGE_HINT = `Decimal degrees. Latitude ${MIN_LATITUDE} to ${MAX_LATITUDE}, longitude ${MIN_LONGITUDE} to ${MAX_LONGITUDE}.`;

const BoundingBoxInputs: React.FC<BoundingBoxInputsProps> = ({
  north,
  south,
  east,
  west,
  onChange,
  latitudeError = false,
  disabled,
}) => {
  const values: Record<BoxEdge, CoordValue> = { north, south, east, west };

  const input = (edge: BoxEdge) => {
    const isLatitude = edge === "north" || edge === "south";
    return (
      <NumberInput
        aria-label={EDGE_ARIA_LABELS[edge]}
        // The compass letter sits inside the box rather than beside it, which
        // is what lets three columns fit a phone-width modal.
        leftSection={
          <Text size="sm" fw={500}>
            {EDGE_LETTERS[edge]}
          </Text>
        }
        leftSectionWidth={30}
        // Spinner arrows step by one degree, which is no use for coordinates,
        // and cost the width the letter needs.
        hideControls
        placeholder={EDGE_PLACEHOLDERS[edge]}
        value={values[edge]}
        onChange={(value) => onChange(edge, value)}
        min={isLatitude ? MIN_LATITUDE : MIN_LONGITUDE}
        max={isLatitude ? MAX_LATITUDE : MAX_LONGITUDE}
        decimalScale={6}
        size="sm"
        // Shrinks on phones so the three-column compass fits a full-screen
        // modal, and settles at 130px on anything wider.
        w="clamp(76px, 24vw, 130px)"
        error={isLatitude ? latitudeError : undefined}
        disabled={disabled}
      />
    );
  };

  return (
    <Box>
      {/* 3x3 grid: N centred on top, W and E on the middle row, S centred below. */}
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto auto",
          gridTemplateRows: "auto auto auto",
          columnGap: "var(--mantine-spacing-sm)",
          rowGap: "var(--mantine-spacing-xs)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box style={{ gridColumn: 2, gridRow: 1 }}>{input("north")}</Box>
        <Box style={{ gridColumn: 1, gridRow: 2 }}>{input("west")}</Box>
        <Box style={{ gridColumn: 3, gridRow: 2 }}>{input("east")}</Box>
        <Box style={{ gridColumn: 2, gridRow: 3 }}>{input("south")}</Box>
      </Box>
      <Text size="xs" c="dimmed" ta="center" mt={6}>
        {RANGE_HINT}
      </Text>
      {latitudeError && (
        <Text size="xs" c="red" ta="center" mt={4}>
          {LATITUDE_ERROR}
        </Text>
      )}
    </Box>
  );
};

export default BoundingBoxInputs;
