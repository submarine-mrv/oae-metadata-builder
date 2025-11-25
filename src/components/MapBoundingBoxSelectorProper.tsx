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
  adjustEastForAntimeridian,
  DEGREES_IN_CIRCLE,
  isValidLatitude
} from "@/utils/spatialUtils";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM
} from "@/config/maps";
import { useMapLibreGL } from "@/hooks/useMapLibreGL";

// Extend Window interface to include maplibregl
declare global {
  interface Window {
    maplibregl?: any;
  }
}

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
  const startPointRef = useRef<{ lng: number; lat: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<string>(initialBounds);
  const [startPoint, setStartPoint] = useState<{
    lng: number;
    lat: number;
  } | null>(null);

  // Use the MapLibre hook for map initialization
  const { mapInstance, isLoaded: mapLoaded } = useMapLibreGL(mapRef, {
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_ZOOM,
    interactive: true
  }, opened);

  // Individual coordinate states
  const [north, setNorth] = useState<number | string>("");
  const [south, setSouth] = useState<number | string>("");
  const [west, setWest] = useState<number | string>("");
  const [east, setEast] = useState<number | string>("");

  // Validation state for N/S
  const [hasLatitudeError, setHasLatitudeError] = useState(false);

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

  // Create bounds string from individual coordinates
  const createBoundsString = useCallback(
    (w: number, s: number, e: number, n: number): string => {
      return `${w.toFixed(6)} ${s.toFixed(6)} ${e.toFixed(6)} ${n.toFixed(6)}`;
    },
    []
  );

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
        const boundsString = createBoundsString(
          newWest,
          newSouth,
          newEast,
          newNorth
        );
        setCurrentBounds(boundsString);

        // Update map if it's loaded and coordinates are valid
        if (mapInstance && mapLoaded && newNorth > newSouth) {
          addBoundingBox(
            mapInstance,
            newWest,
            newSouth,
            newEast,
            newNorth
          );
          // For fitBounds: if W > E (antimeridian), translate E to +360 range
          const fitEast = adjustEastForAntimeridian(newWest, newEast);
          mapInstance.fitBounds(
            [
              [newWest, newSouth],
              [fitEast, newNorth]
            ],
            {
              padding: 20,
              duration: 500
            }
          );
        }
      }
    },
    [createBoundsString, mapLoaded]
  );

  // Load initial bounds when map is ready
  useEffect(() => {
    if (!mapInstance || !mapLoaded) return;

    // Add initial bounds if provided
    if (initialBounds.trim()) {
      const parts = initialBounds.trim().split(/\s+/).map(Number);
      if (parts.length === 4) {
        const [west, south, east, north] = parts;
        addBoundingBox(mapInstance, west, south, east, north);
        // Smooth zoom to bounds with animation - handle antimeridian
        const fitEast = adjustEastForAntimeridian(west, east);
        mapInstance.fitBounds(
          [
            [west, south],
            [fitEast, north]
          ],
          {
            padding: 50
            // Remove duration: 0 to restore smooth animation
          }
        );
        setCurrentBounds(initialBounds);
      }
    }
  }, [mapInstance, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const addBoundingBox = (
    map: any,
    west: number,
    south: number,
    east: number,
    north: number
  ) => {
    // Remove existing bounding box
    if (map.getSource("bbox")) {
      map.removeLayer("bbox-fill");
      map.removeLayer("bbox-outline");
      map.removeSource("bbox");
    }

    // For rendering: if W > E (antimeridian crossing), translate E to +360 range
    // so MapLibre draws the short way
    const renderWest = west;
    const renderEast = adjustEastForAntimeridian(west, east);

    // Add bounding box as GeoJSON
    map.addSource("bbox", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [renderWest, north],
              [renderEast, north],
              [renderEast, south],
              [renderWest, south],
              [renderWest, north]
            ]
          ]
        }
      }
    });

    // Add fill layer
    map.addLayer({
      id: "bbox-fill",
      type: "fill",
      source: "bbox",
      paint: {
        "fill-color": "#ff7800",
        "fill-opacity": 0.1
      }
    });

    // Add outline layer
    map.addLayer({
      id: "bbox-outline",
      type: "line",
      source: "bbox",
      paint: {
        "line-color": "#ff7800",
        "line-width": 2
      }
    });
  };

  const startSelection = () => {
    if (!mapInstance) return;
    const map = mapInstance;

    setIsSelecting(true);
    setStartPoint(null);
    startPointRef.current = null;

    // Remove existing bounding box
    if (map.getSource("bbox")) {
      map.removeLayer("bbox-fill");
      map.removeLayer("bbox-outline");
      map.removeSource("bbox");
    }

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
        const boundsString = `${west.toFixed(6)} ${south.toFixed(
          6
        )} ${east.toFixed(6)} ${north.toFixed(6)}`;
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
      // Map cleanup is handled by the useMapLibreGL hook
      // Reset all state
      setCurrentBounds(initialBounds);
      setIsSelecting(false);
      setStartPoint(null);
      startPointRef.current = null;
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
