import {
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconMap } from "@tabler/icons-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type DrawPoint, useTwoPointDraw } from "@/hooks/useTwoPointDraw";
import {
  addBoundingBox,
  addLine,
  formatBoundsString,
  lineBounds,
  parseBoundsString,
  removeBoundingBox,
  removeLine,
  setBoundingBoxData,
  setLineData,
} from "@/utils/mapLayerUtils";
import {
  adjustEastForAntimeridian,
  clampLatitude,
  normalizeLongitude,
  resolveBoxFromClicks,
} from "@/utils/spatialUtils";
import BoundingBoxInputs, { type BoxEdge } from "./BoundingBoxInputs";

// Layer namespaces, so the dosing shapes never collide with a spatial-coverage box.
const BBOX_OPTS = { sourceId: "dosing-bbox" } as const;
const LINE_OPTS = { sourceId: "dosing-line" } as const;

type DosingMode = "point" | "line" | "box";

interface DosingLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  geoData: any;
  fileLocation: string;
  mode: DosingMode | null;
  onChange: (geoData: any, fileLocation?: string, mode?: DosingMode) => void;
}

const DosingLocationMapModal: React.FC<DosingLocationMapModalProps> = ({
  isOpen,
  onClose,
  geoData,
  fileLocation,
  mode,
  onChange,
}) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineLayerIdRef = useRef<string | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [localMode, setLocalMode] = useState<DosingMode | null>(mode);

  // Point mode state - individual coordinate states
  const [pointLat, setPointLat] = useState<number | string>(() => {
    if (geoData?.latitude !== undefined) {
      return geoData.latitude;
    }
    return "";
  });
  const [pointLon, setPointLon] = useState<number | string>(() => {
    if (geoData?.longitude !== undefined) {
      return geoData.longitude;
    }
    return "";
  });

  // Line mode state - individual coordinate states
  const [line1Lat, setLine1Lat] = useState<number | string>(() => {
    if (geoData?.line && typeof geoData.line === "string") {
      const parts = geoData.line.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[0]);
    }
    return "";
  });
  const [line1Lon, setLine1Lon] = useState<number | string>(() => {
    if (geoData?.line && typeof geoData.line === "string") {
      const parts = geoData.line.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[1]);
    }
    return "";
  });
  const [line2Lat, setLine2Lat] = useState<number | string>(() => {
    if (geoData?.line && typeof geoData.line === "string") {
      const parts = geoData.line.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[2]);
    }
    return "";
  });
  const [line2Lon, setLine2Lon] = useState<number | string>(() => {
    if (geoData?.line && typeof geoData.line === "string") {
      const parts = geoData.line.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[3]);
    }
    return "";
  });

  // Box mode state - parse initial box string via shared helper
  const initialBox =
    geoData?.box && typeof geoData.box === "string" ? parseBoundsString(geoData.box) : null;
  const [north, setNorth] = useState<number | string>(initialBox?.north ?? "");
  const [south, setSouth] = useState<number | string>(initialBox?.south ?? "");
  const [west, setWest] = useState<number | string>(initialBox?.west ?? "");
  const [east, setEast] = useState<number | string>(initialBox?.east ?? "");

  const [localFileLocation, setLocalFileLocation] = useState(fileLocation);

  // Clear markers helper
  const clearMarkers = () => {
    markersRef.current.forEach((marker) => {
      marker.remove();
    });
    markersRef.current = [];
  };

  const clearLineLayer = useCallback(() => {
    if (mapInstanceRef.current) removeLine(mapInstanceRef.current, LINE_OPTS);
    lineLayerIdRef.current = null;
  }, []);

  const drawLine = useCallback(
    (map: any, lat1: number, lon1: number, lat2: number, lon2: number) => {
      addLine(map, lat1, lon1, lat2, lon2, LINE_OPTS);
      lineLayerIdRef.current = LINE_OPTS.sourceId;
    },
    [],
  );

  // Handle manual coordinate input changes (for line mode)
  const handleLineCoordinateChange = useCallback(
    (
      newLat1: number | string,
      newLon1: number | string,
      newLat2: number | string,
      newLon2: number | string,
    ) => {
      // Only update line if all values are valid numbers
      if (
        typeof newLat1 === "number" &&
        typeof newLon1 === "number" &&
        typeof newLat2 === "number" &&
        typeof newLon2 === "number" &&
        mapInstanceRef.current &&
        mapLoaded
      ) {
        drawLine(mapInstanceRef.current, newLat1, newLon1, newLat2, newLon2);

        // Fit bounds to line. Same unwrapped endpoint the line is drawn with, or
        // the camera frames the long way round across the antimeridian.
        const bounds = new window.maplibregl.LngLatBounds(
          ...lineBounds(newLat1, newLon1, newLat2, newLon2),
        );
        mapInstanceRef.current.fitBounds(bounds, {
          padding: 50,
          duration: 500,
        });
      }
    },
    [addLine, mapLoaded],
  );

  // Line mode drawing — preview tracks the cursor between the two points.
  const handleLinePreview = useCallback((from: DrawPoint, to: DrawPoint) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setLineData(map, from.lat, from.lng, to.lat, to.lng, LINE_OPTS);
    lineLayerIdRef.current = LINE_OPTS.sourceId;
  }, []);

  const handleLineComplete = useCallback(
    (from: DrawPoint, to: DrawPoint) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      // Dragging past a pole or across the antimeridian yields values outside
      // the input ranges, so bring both endpoints back in range first.
      const lat1 = clampLatitude(from.lat);
      const lon1 = normalizeLongitude(from.lng);
      const lat2 = clampLatitude(to.lat);
      const lon2 = normalizeLongitude(to.lng);
      drawLine(map, lat1, lon1, lat2, lon2);
      setLine1Lat(lat1);
      setLine1Lon(lon1);
      setLine2Lat(lat2);
      setLine2Lon(lon2);
    },
    [drawLine],
  );

  // Handle manual coordinate input changes (for box mode)
  const handleCoordinateChange = useCallback(
    (
      newWest: number | string,
      newSouth: number | string,
      newEast: number | string,
      newNorth: number | string,
    ) => {
      // Only update bounds if all values are valid numbers
      if (
        typeof newWest === "number" &&
        typeof newSouth === "number" &&
        typeof newEast === "number" &&
        typeof newNorth === "number" &&
        mapInstanceRef.current &&
        mapLoaded
      ) {
        addBoundingBox(mapInstanceRef.current, newWest, newSouth, newEast, newNorth, BBOX_OPTS);
        const fitEast = adjustEastForAntimeridian(newWest as number, newEast as number);
        mapInstanceRef.current.fitBounds(
          [
            [newWest, newSouth],
            [fitEast, newNorth],
          ],
          {
            padding: 20,
            duration: 500,
          },
        );
      }
    },
    [mapLoaded],
  );

  // Handle manual coordinate input changes (for point mode)
  const handlePointCoordinateChange = useCallback(
    (newLat: number | string, newLon: number | string) => {
      // Only update point if both values are valid numbers
      if (
        typeof newLat === "number" &&
        typeof newLon === "number" &&
        mapInstanceRef.current &&
        mapLoaded
      ) {
        // Clear existing markers
        markersRef.current.forEach((marker) => {
          marker.remove();
        });
        markersRef.current = [];

        // Add new marker
        const marker = new window.maplibregl.Marker({ color: "#228be6" })
          .setLngLat([newLon, newLat])
          .addTo(mapInstanceRef.current);
        markersRef.current.push(marker);

        // Fly to the point
        mapInstanceRef.current.flyTo({
          center: [newLon, newLat],
          zoom: 8,
          duration: 500,
        });
      }
    },
    [mapLoaded],
  );

  // Box mode drawing — preview tracks the cursor between the two corners.
  const handleBoxPreview = useCallback((from: DrawPoint, to: DrawPoint) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const { west: w, south: s, east: e, north: n } = resolveBoxFromClicks(from, to);
    setBoundingBoxData(map, w, s, e, n, BBOX_OPTS);
  }, []);

  const handleBoxComplete = useCallback((from: DrawPoint, to: DrawPoint) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const { west: w, south: s, east: e, north: n } = resolveBoxFromClicks(from, to);
    addBoundingBox(map, w, s, e, n, BBOX_OPTS);
    setWest(w);
    setSouth(s);
    setEast(e);
    setNorth(n);
  }, []);

  const handleDrawStart = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (localMode === "box") removeBoundingBox(map, BBOX_OPTS);
    else clearLineLayer();
  }, [localMode, clearLineLayer]);

  const {
    isDrawing,
    hasStartPoint,
    start: startSelection,
    cancel: cancelSelection,
  } = useTwoPointDraw({
    map: mapLoaded ? mapInstanceRef.current : null,
    onPreview: localMode === "box" ? handleBoxPreview : handleLinePreview,
    onComplete: localMode === "box" ? handleBoxComplete : handleLineComplete,
    onStart: handleDrawStart,
    // Same cleanup: a gesture given up mid-draw must not leave its preview.
    onAbandon: handleDrawStart,
  });

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

  // Initialize map function
  const initializeMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new window.maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-123.0, 47.5],
      zoom: 2,
    });

    mapInstanceRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);

      // Load existing box data if in box mode
      if (localMode === "box" && geoData?.box) {
        const bounds = parseBoundsString(geoData.box);
        if (bounds) {
          const { west, south, east, north } = bounds;
          addBoundingBox(map, west, south, east, north, BBOX_OPTS);
          const fitEast = adjustEastForAntimeridian(west, east);
          map.fitBounds(
            [
              [west, south],
              [fitEast, north],
            ],
            { padding: 50 },
          );
        }
      }

      // Load existing line data if in line mode
      if (localMode === "line" && geoData?.line) {
        const parts = geoData.line.trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          const [lat1, lon1, lat2, lon2] = parts;
          drawLine(map, lat1, lon1, lat2, lon2);
          const bounds = new window.maplibregl.LngLatBounds(...lineBounds(lat1, lon1, lat2, lon2));
          map.fitBounds(bounds, { padding: 50 });
        }
      }

      // Load existing point data if in point mode
      if (
        localMode === "point" &&
        geoData?.latitude !== undefined &&
        geoData?.longitude !== undefined
      ) {
        const lat = geoData.latitude;
        const lon = geoData.longitude;
        const marker = new window.maplibregl.Marker({ color: "#228be6" })
          .setLngLat([lon, lat])
          .addTo(map);
        markersRef.current.push(marker);
        map.flyTo({ center: [lon, lat], zoom: 8, duration: 0 });
      }

      // Add click handler for point mode only
      if (localMode === "point") {
        map.on("click", (e: any) => {
          const { lng, lat } = e.lngLat;
          setPointLat(lat);
          setPointLon(lng);
        });
      }
    });
  }, [localMode, geoData, drawLine]);

  // Load MapLibre and initialize map when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadAndInitialize = async () => {
      // Load MapLibre if not already loaded
      if (!window.maplibregl) {
        // Load CSS
        if (!document.querySelector('link[href*="maplibre-gl.css"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/maplibre-gl@4.5.2/dist/maplibre-gl.css";
          document.head.appendChild(link);
        }

        // Load JS
        const script = document.createElement("script");
        script.src = "https://unpkg.com/maplibre-gl@4.5.2/dist/maplibre-gl.js";

        await new Promise((resolve) => {
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      // Wait for next tick to ensure DOM is ready
      requestAnimationFrame(() => {
        if (mapRef.current && !mapInstanceRef.current) {
          initializeMap();
        }
      });
    };

    loadAndInitialize();

    return () => {
      // Detach draw listeners before disposing the map they are attached to.
      cancelSelection();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      // Switching modes rebuilds the map. Without this the flag stays true, no
      // re-render follows, and the draw hook keeps a handle on the removed map.
      setMapLoaded(false);
    };
  }, [isOpen, initializeMap, cancelSelection]);

  // Update markers for point mode
  useEffect(() => {
    if (!mapInstanceRef.current || localMode !== "point") return;

    clearMarkers();

    if (typeof pointLat === "number" && typeof pointLon === "number") {
      const marker = new window.maplibregl.Marker({ color: "#228be6" })
        .setLngLat([pointLon, pointLat])
        .addTo(mapInstanceRef.current);
      markersRef.current.push(marker);

      mapInstanceRef.current.flyTo({ center: [pointLon, pointLat], zoom: 8 });
    }
  }, [pointLat, pointLon, localMode]);

  const handleModeChange = (newMode: DosingMode | null) => {
    if (!newMode) return;

    setLocalMode(newMode);

    // Clear all data when switching modes
    setPointLat("");
    setPointLon("");
    setLine1Lat("");
    setLine1Lon("");
    setLine2Lat("");
    setLine2Lon("");
    setNorth("");
    setSouth("");
    setEast("");
    setWest("");
    setLocalFileLocation("");
    clearMarkers();
    clearLineLayer();
    cancelSelection();
    if (mapInstanceRef.current) removeBoundingBox(mapInstanceRef.current, BBOX_OPTS);
  };

  const handleSave = () => {
    if (!localMode) return;

    // Validate box mode requires file location
    if (localMode === "box" && !localFileLocation.trim()) {
      alert("Dosing file location is required");
      return;
    }

    let newGeoData = {};

    if (localMode === "point" && typeof pointLat === "number" && typeof pointLon === "number") {
      newGeoData = {
        latitude: pointLat,
        longitude: pointLon,
      };
    } else if (
      localMode === "line" &&
      typeof line1Lat === "number" &&
      typeof line1Lon === "number" &&
      typeof line2Lat === "number" &&
      typeof line2Lon === "number"
    ) {
      // Format: "lat1 lon1 lat2 lon2" separated by spaces
      const lineString = `${line1Lat} ${line1Lon} ${line2Lat} ${line2Lon}`;
      newGeoData = {
        line: lineString,
      };
    } else if (
      localMode === "box" &&
      typeof west === "number" &&
      typeof south === "number" &&
      typeof east === "number" &&
      typeof north === "number"
    ) {
      const boxString = formatBoundsString(west, south, east, north);
      newGeoData = {
        box: boxString,
      };
    }

    onChange(newGeoData, localMode === "box" ? localFileLocation : undefined, localMode);
    onClose();
  };

  const getHelperText = () => {
    if (!mapLoaded) return "Loading map...";
    if (!localMode) return "Select a dosing location type above";

    switch (localMode) {
      case "point":
        return typeof pointLat === "number" && typeof pointLon === "number"
          ? "Point selected. Click elsewhere to change, or enter coordinates, or click Save to confirm."
          : "Click on the map to select a fixed point dosing location, or enter coordinates below.";
      case "line":
        if (!isDrawing) {
          return "Enter coordinates, or use 'Draw Selection' to drag a line on the map.";
        }
        return hasStartPoint
          ? "Release, or click again to complete the line."
          : "Drag a line on the map, or click each end.";
      case "box":
        if (!isDrawing) {
          return "Enter coordinates, or use 'Draw Selection' to drag a box on the map.";
        }
        return hasStartPoint
          ? "Release, or click again to complete the box."
          : "Drag a box on the map, or click each corner.";
      default:
        return "";
    }
  };

  const canSave = () => {
    if (!localMode) return false;
    if (localMode === "point") return typeof pointLat === "number" && typeof pointLon === "number";
    if (localMode === "line")
      return (
        typeof line1Lat === "number" &&
        typeof line1Lon === "number" &&
        typeof line2Lat === "number" &&
        typeof line2Lon === "number"
      );
    if (localMode === "box")
      return (
        typeof west === "number" &&
        typeof south === "number" &&
        typeof east === "number" &&
        typeof north === "number" &&
        localFileLocation.trim() !== ""
      );
    return false;
  };

  const modeOptions = [
    { value: "point", label: "Fixed Point" },
    { value: "line", label: "Line" },
    { value: "box", label: "Provided as a file" },
  ];

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Set Dosing Location"
      size="xl"
      fullScreen={isMobile ?? false}
    >
      <Stack gap="md">
        <Select
          label="Dosing Location Type"
          placeholder="Select location type"
          data={modeOptions}
          value={localMode}
          onChange={(value) => handleModeChange(value as DosingMode | null)}
          required
        />

        {localMode === "box" && (
          <TextInput
            label="Dosing Location File"
            placeholder="DOI; filename"
            description="Exact path and filename for the location file (relative to project root)."
            value={localFileLocation}
            onChange={(e) => setLocalFileLocation(e.target.value)}
            required
            withAsterisk
          />
        )}

        <Text size="sm" c="dimmed">
          {getHelperText()}
        </Text>

        <Box style={{ position: "relative" }}>
          <div
            ref={mapRef}
            style={{
              width: "100%",
              height: localMode === "box" ? "250px" : "400px",
              borderRadius: "4px",
              border: "1px solid var(--brand-twilight)",
              opacity: !localMode ? 0.5 : 1,
            }}
          />

          {/* Greyed out overlay when no mode selected */}
          {!localMode && (
            <Box
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--brand-sunlight-overlay)",
                borderRadius: "4px",
                border: "1px solid var(--brand-twilight)",
                padding: "8px",
                pointerEvents: "none",
              }}
            >
              <IconMap size={48} style={{ marginBottom: "12px", opacity: 0.4 }} />
              <Text size="sm" ta="center" c="dimmed" fw={500}>
                Select location type to activate map
              </Text>
            </Box>
          )}
        </Box>

        {/* Coordinate inputs for point mode */}
        {localMode === "point" && (
          <Stack gap="xs" align="center">
            <Group gap="xs">
              <NumberInput
                label="Latitude"
                placeholder="Latitude"
                value={pointLat}
                onChange={(value) => {
                  setPointLat(value);
                  handlePointCoordinateChange(value, pointLon);
                }}
                min={-90}
                max={90}
                decimalScale={6}
                size="sm"
                style={{ width: "120px" }}
              />
              <NumberInput
                label="Longitude"
                placeholder="Longitude"
                value={pointLon}
                onChange={(value) => {
                  setPointLon(value);
                  handlePointCoordinateChange(pointLat, value);
                }}
                min={-180}
                max={180}
                decimalScale={6}
                size="sm"
                style={{ width: "120px" }}
              />
            </Group>
          </Stack>
        )}

        {/* Coordinate inputs for line mode */}
        {localMode === "line" && (
          <Stack gap="xs" align="center">
            <Group gap="xs">
              <Text size="sm" fw={500} style={{ width: "60px" }}>
                Point 1:
              </Text>
              <NumberInput
                placeholder="Latitude"
                value={line1Lat}
                onChange={(value) => {
                  setLine1Lat(value);
                  handleLineCoordinateChange(value, line1Lon, line2Lat, line2Lon);
                }}
                min={-90}
                max={90}
                decimalScale={6}
                size="sm"
                style={{ width: "120px" }}
              />
              <NumberInput
                placeholder="Longitude"
                value={line1Lon}
                onChange={(value) => {
                  setLine1Lon(value);
                  handleLineCoordinateChange(line1Lat, value, line2Lat, line2Lon);
                }}
                min={-180}
                max={180}
                decimalScale={6}
                size="sm"
                style={{ width: "120px" }}
              />
            </Group>
            <Group gap="xs" align="center">
              <Text size="sm" fw={500} style={{ width: "60px" }}>
                Point 2:
              </Text>
              <NumberInput
                placeholder="Latitude"
                value={line2Lat}
                onChange={(value) => {
                  setLine2Lat(value);
                  handleLineCoordinateChange(line1Lat, line1Lon, value, line2Lon);
                }}
                min={-90}
                max={90}
                decimalScale={6}
                size="sm"
                style={{ width: "120px" }}
              />
              <NumberInput
                placeholder="Longitude"
                value={line2Lon}
                onChange={(value) => {
                  setLine2Lon(value);
                  handleLineCoordinateChange(line1Lat, line1Lon, line2Lat, value);
                }}
                min={-180}
                max={180}
                decimalScale={6}
                size="sm"
                style={{ width: "120px" }}
              />
            </Group>
          </Stack>
        )}

        {/* Coordinate inputs for box mode */}
        {localMode === "box" && (
          <BoundingBoxInputs
            north={north}
            south={south}
            east={east}
            west={west}
            onChange={handleEdgeChange}
          />
        )}

        <Box
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {(localMode === "line" || localMode === "box") && mapLoaded && (
            <Button variant="outline" onClick={startSelection} disabled={isDrawing}>
              {isDrawing ? "Drawing..." : "Draw Selection"}
            </Button>
          )}

          <Group
            gap="xs"
            style={{
              marginLeft: localMode === "line" || localMode === "box" ? undefined : "auto",
            }}
          >
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave()}>
              Save
            </Button>
          </Group>
        </Box>
      </Stack>
    </Modal>
  );
};

export default DosingLocationMapModal;
