import { Box, Button, Modal, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MAP_CENTER, DEFAULT_ZOOM, MAP_TILE_STYLE } from "@/config/maps";
import { useMapLibreLoader } from "@/hooks/useMapLibreLoader";
import { type DrawPoint, useTwoPointDraw } from "@/hooks/useTwoPointDraw";
import {
  addBoundingBox,
  fitBoundsWithAntimeridian,
  formatBoundsString,
  parseBoundsString,
  removeBoundingBox,
  setBoundingBoxData,
} from "@/utils/mapLayerUtils";
import { resolveBoxFromClicks } from "@/utils/spatialUtils";
import BoundingBoxInputs, { type BoxEdge } from "./BoundingBoxInputs";

interface SpatialCoverageMapModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (bounds: string) => void;
  initialBounds?: string;
}

const SpatialCoverageMapModal: React.FC<SpatialCoverageMapModalProps> = ({
  opened,
  onClose,
  onSelect,
  initialBounds = "",
}) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [currentBounds, setCurrentBounds] = useState<string>(initialBounds);
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

  // Parse bounds string into individual coordinate state
  const parseBounds = useCallback((boundsString: string) => {
    const bounds = parseBoundsString(boundsString);
    if (bounds) {
      setWest(bounds.west);
      setSouth(bounds.south);
      setEast(bounds.east);
      setNorth(bounds.north);
      setHasLatitudeError(bounds.north <= bounds.south);
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
      newNorth: number | string,
    ) => {
      // Check for latitude validation error
      if (typeof newNorth === "number" && typeof newSouth === "number" && newNorth <= newSouth) {
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
          fitBoundsWithAntimeridian(mapInstanceRef.current, newWest, newSouth, newEast, newNorth, {
            padding: 20,
            duration: 500,
          });
        }
      }
    },
    [mapLoaded],
  );

  /** Route a single edge's change through the existing four-value handler. */
  const handleEdgeChange = useCallback(
    (edge: BoxEdge, value: number | string) => {
      const next = { north, south, east, west, [edge]: value };
      if (edge === "north") setNorth(value);
      else if (edge === "south") setSouth(value);
      else if (edge === "east") setEast(value);
      else setWest(value);
      handleCoordinateChange(next.west, next.south, next.east, next.north);
    },
    [north, south, east, west, handleCoordinateChange],
  );

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.maplibregl || mapInstanceRef.current) return;

    const map = new window.maplibregl.Map({
      container: mapRef.current,
      style: MAP_TILE_STYLE,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    mapInstanceRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);

      // Add initial bounds if provided
      if (initialBounds.trim()) {
        const bounds = parseBoundsString(initialBounds);
        if (bounds) {
          const { west, south, east, north } = bounds;
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

  const handleDrawPreview = useCallback((from: DrawPoint, to: DrawPoint) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const { west, south, east, north } = resolveBoxFromClicks(from, to);
    setBoundingBoxData(map, west, south, east, north);
  }, []);

  const handleDrawComplete = useCallback((from: DrawPoint, to: DrawPoint) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const { west, south, east, north } = resolveBoxFromClicks(from, to);

    addBoundingBox(map, west, south, east, north);
    setCurrentBounds(formatBoundsString(west, south, east, north));
    setWest(west);
    setSouth(south);
    setEast(east);
    setNorth(north);
    setHasLatitudeError(north <= south);
  }, []);

  const handleDrawStart = useCallback(() => {
    if (mapInstanceRef.current) removeBoundingBox(mapInstanceRef.current);
  }, []);

  const {
    isDrawing,
    hasStartPoint,
    start: startSelection,
    cancel: cancelSelection,
  } = useTwoPointDraw({
    map: mapLoaded ? mapInstanceRef.current : null,
    onPreview: handleDrawPreview,
    onComplete: handleDrawComplete,
    onStart: handleDrawStart,
  });

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
      // Detach draw listeners before disposing the map they are attached to.
      cancelSelection();

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      setCurrentBounds(initialBounds);
      setMapLoaded(false);
      parseBounds(initialBounds);
    }
  }, [opened, initialBounds, parseBounds, cancelSelection]);

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title="Select Bounding Box"
      size="xl"
      centered
      fullScreen={isMobile ?? false}
      zIndex={1100}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {!mapLoaded
            ? "Loading map..."
            : !isDrawing
              ? "Enter coordinates, or use 'Draw Selection' to drag a box on the map."
              : hasStartPoint
                ? "Release, or click again to complete the box."
                : "Drag a box on the map, or click each corner."}
        </Text>

        <Box
          ref={mapRef}
          style={{
            height: "400px",
            width: "100%",
            border: "1px solid var(--brand-twilight)",
            borderRadius: "4px",
            position: "relative",
          }}
        />

        <BoundingBoxInputs
          north={north}
          south={south}
          east={east}
          west={west}
          latitudeError={hasLatitudeError}
          onChange={handleEdgeChange}
        />

        <Box
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {mapLoaded && (
            <Button variant="outline" onClick={startSelection} disabled={isDrawing}>
              {isDrawing ? "Drawing..." : "Draw Selection"}
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

export default SpatialCoverageMapModal;
