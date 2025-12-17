"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Modal,
  Button,
  Text,
  Box,
  Stack,
  NumberInput,
  Group
} from "@mantine/core";
import {
  normalizeLongitude,
  DEGREES_IN_CIRCLE,
  isValidLatitude
} from "@/utils/spatialUtils";
import {
  addBoundingBox,
  removeBoundingBox,
  fitBoundsWithAntimeridian,
  formatBoundsString
} from "@/utils/mapLayerUtils";
import { useMapLibreLoader } from "@/hooks/useMapLibreLoader";
import {
  MAP_TILE_STYLE,
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM
} from "@/config/maps";

interface MapBoundingBoxSelectorProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (bounds: string) => void;
  initialBounds?: string;
}

const MapBoundingBoxSelectorProper: React.FC<MapBoundingBoxSelectorProps> = ({
  opened,
  onClose,
  onSelect,
  initialBounds = ""
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const startPointRef = useRef<{ lng: number; lat: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<string>(initialBounds);
  const [startPoint, setStartPoint] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Individual coordinate states
  const [north, setNorth] = useState<number | string>("");
  const [south, setSouth] = useState<number | string>("");
  const [west, setWest] = useState<number | string>("");
  const [east, setEast] = useState<number | string>("");

  // Validation state for N/S
  const [hasLatitudeError, setHasLatitudeError] = useState(false);

  // Load MapLibre using the shared hook (don't auto-load, only when modal opens)
  const { isLoaded: mapLibreLoaded, loadMapLibre } = useMapLibreLoader(false);

  // Parse bounds string "W S E N" into individual coordinates
  const parseBounds = useCallback((boundsString: string) => {
    const parts = boundsString.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [w, s, e, n] = parts;
      setWest(w);
      setSouth(s);
      setEast(e);
      setNorth(n);
      // Check for latitude error
      setHasLatitudeError(n <= s);
    } else {
      setWest("");
      setSouth("");
      setEast("");
      setNorth("");
      setHasLatitudeError(false);
    }
  }, []);

  // Handle manual coordinate input changes
  const handleCoordinateChange = useCallback(
    (
      newWest: number | string,
      newSouth: number | string,
      newEast: number | string,
      newNorth: number | string
    ) => {
      // Check for latitude validation error
      if (
        typeof newNorth === "number" &&
        typeof newSouth === "number" &&
        newNorth <= newSouth
      ) {
        setHasLatitudeError(true);
      } else {
        setHasLatitudeError(false);
      }

      // Only update bounds if all values are valid numbers
      if (
        typeof newWest === "number" &&
        typeof newSouth === "number" &&
        typeof newEast === "number" &&
        typeof newNorth === "number"
      ) {
        const boundsString = formatBoundsString(newWest, newSouth, newEast, newNorth);
        setCurrentBounds(boundsString);

        // Update map if it's loaded and coordinates are valid
        if (mapInstanceRef.current && mapLoaded && newNorth > newSouth) {
          addBoundingBox(mapInstanceRef.current, newWest, newSouth, newEast, newNorth);
          fitBoundsWithAntimeridian(mapInstanceRef.current, newWest, newSouth, newEast, newNorth, { padding: 20, duration: 500 });
        }
      }
    },
    [mapLoaded]
  );

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.maplibregl || mapInstanceRef.current) return;

    const map = new window.maplibregl.Map({
      container: mapRef.current,
      style: MAP_TILE_STYLE,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_ZOOM
    });

    mapInstanceRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);

      // Add initial bounds if provided
      if (initialBounds.trim()) {
        const parts = initialBounds.trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          const [west, south, east, north] = parts;
          addBoundingBox(map, west, south, east, north);
          fitBoundsWithAntimeridian(map, west, south, east, north, { padding: 50 });
          setCurrentBounds(initialBounds);
        }
      }
    });

    return map;
  }, [initialBounds]);

  // Load MapLibre when modal opens
  useEffect(() => {
    if (opened && !mapLibreLoaded) {
      loadMapLibre();
    }
  }, [opened, mapLibreLoaded, loadMapLibre]);

  // Initialize map once MapLibre is loaded and modal is open
  useEffect(() => {
    if (!opened || !mapLibreLoaded) return;

    requestAnimationFrame(() => {
      if (mapRef.current && !mapInstanceRef.current) {
        initializeMap();
      }
    });
  }, [opened, mapLibreLoaded, initializeMap]);

  const startSelection = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    setIsSelecting(true);
    setStartPoint(null);
    startPointRef.current = null;

    // Remove existing bounding box
    removeBoundingBox(map);

    map.getCanvas().style.cursor = "crosshair";

    const onMapClick = (e: any) => {
      const { lng, lat } = e.lngLat;

      if (!startPointRef.current) {
        // First click - start selection
        startPointRef.current = { lng, lat };
        setStartPoint({ lng, lat });
      } else {
        // Second click - complete selection
        const startPt = startPointRef.current;

        // Normalize coordinates to -180 to 180 range
        const lng1 = normalizeLongitude(startPt.lng);
        const lng2 = normalizeLongitude(lng);

        // Determine if we're crossing the antimeridian by checking shortest path
        const directDistance = Math.abs(lng2 - lng1);
        const wrapDistance = DEGREES_IN_CIRCLE - directDistance;
        const crossesAntimeridian = wrapDistance < directDistance;

        let west, east;
        if (crossesAntimeridian) {
          // Crossing antimeridian: W should be larger value (closer to +180)
          // E should be smaller value (closer to -180)
          west = Math.max(lng1, lng2);
          east = Math.min(lng1, lng2);
        } else {
          // Not crossing: normal min/max
          west = Math.min(lng1, lng2);
          east = Math.max(lng1, lng2);
        }

        const south = Math.min(startPt.lat, lat);
        const north = Math.max(startPt.lat, lat);

        // Validate coordinates are within valid ranges
        if (!isValidLatitude(south) || !isValidLatitude(north)) {
          console.error('Invalid latitude coordinates:', { south, north });
          return;
        }

        // Add final bounding box
        addBoundingBox(map, west, south, east, north);

        // Format as "W S E N"
        const boundsString = formatBoundsString(west, south, east, north);
        setCurrentBounds(boundsString);

        // Update individual coordinate states
        setWest(west);
        setSouth(south);
        setEast(east);
        setNorth(north);

        // Update validation error state
        setHasLatitudeError(north <= south);

        // Clean up
        map.off("click", onMapClick);
        map.getCanvas().style.cursor = "";
        setIsSelecting(false);
        setStartPoint(null);
        startPointRef.current = null;
      }
    };

    map.on("click", onMapClick);
  };

  const handleConfirm = () => {
    if (currentBounds) {
      onSelect(currentBounds);
    }
    onClose();
  };

  const handleCancel = () => {
    setCurrentBounds(initialBounds);
    onClose();
  };

  // Initialize coordinate fields when modal opens or initialBounds changes
  useEffect(() => {
    if (opened) {
      setCurrentBounds(initialBounds);
      parseBounds(initialBounds);
    }
  }, [opened, initialBounds, parseBounds]);

  // Reset state when modal closes
  useEffect(() => {
    if (!opened) {
      // Clean up map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Reset all state
      setCurrentBounds(initialBounds);
      setIsSelecting(false);
      setStartPoint(null);
      startPointRef.current = null;
      setMapLoaded(false);
      parseBounds(initialBounds);
    }
  }, [opened, initialBounds, parseBounds]);

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title="Select Bounding Box"
      size="xl"
      centered
      zIndex={1100}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {!mapLoaded
            ? "Loading map..."
            : !isSelecting
            ? "Enter coordinates or 'Draw Selection' by clicking two points on the map to define your bounding box."
            : startPoint
            ? "Click second point to complete selection"
            : "Click first point to start selection"}
        </Text>

        <Box
          ref={mapRef}
          style={{
            height: "400px",
            width: "100%",
            border: "1px solid #ccc",
            borderRadius: "4px",
            position: "relative"
          }}
        />

        {/* Coordinate input fields without title */}
        <Stack gap="xs" align="center">
          <Group gap="md" align="flex-start" justify="center">
            <NumberInput
              label="°N (max latitude)"
              placeholder="e.g., 47.8"
              value={north}
              onChange={(value) => {
                setNorth(value);
                handleCoordinateChange(west, south, east, value);
              }}
              min={-90}
              max={90}
              decimalScale={6}
              size="sm"
              style={{ width: "150px" }}
              error={hasLatitudeError}
            />
            <NumberInput
              label="°E (east edge)"
              placeholder="e.g., -122.0"
              value={east}
              onChange={(value) => {
                setEast(value);
                handleCoordinateChange(west, south, value, north);
              }}
              min={-180}
              max={180}
              decimalScale={6}
              size="sm"
              style={{ width: "150px" }}
            />
          </Group>
          <Box>
            <Group gap="md" align="flex-start" justify="center">
              <NumberInput
                label="°S (min latitude)"
                placeholder="e.g., 47.2"
                value={south}
                onChange={(value) => {
                  setSouth(value);
                  handleCoordinateChange(west, value, east, north);
                }}
                min={-90}
                max={90}
                decimalScale={6}
                size="sm"
                style={{ width: "150px" }}
                error={hasLatitudeError}
              />
              <NumberInput
                label="°W (west edge)"
                placeholder="e.g., -123.5"
                value={west}
                onChange={(value) => {
                  setWest(value);
                  handleCoordinateChange(value, south, east, north);
                }}
                min={-180}
                max={180}
                decimalScale={6}
                size="sm"
                style={{ width: "150px" }}
              />
            </Group>
            {hasLatitudeError && (
              <Text size="xs" c="red" mt={4}>
                North latitude must be greater than South latitude
              </Text>
            )}
          </Box>
        </Stack>

        <Box
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          {mapLoaded && (
            <Button
              variant="outline"
              onClick={startSelection}
              disabled={isSelecting}
            >
              {isSelecting ? "Drawing..." : "Draw Selection"}
            </Button>
          )}

          <Box style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!currentBounds || hasLatitudeError}>
              Confirm
            </Button>
          </Box>
        </Box>
      </Stack>
    </Modal>
  );
};

export default MapBoundingBoxSelectorProper;
