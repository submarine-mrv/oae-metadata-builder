"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  TextInput,
  NumberInput,
  Box,
  Select
} from "@mantine/core";
import { IconMap } from "@tabler/icons-react";

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
  onChange
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineLayerIdRef = useRef<string | null>(null);
  const startPointRef = useRef<{ lng: number; lat: number } | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
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

  // Box mode state - individual coordinate states
  const [north, setNorth] = useState<number | string>(() => {
    if (geoData?.box && typeof geoData.box === "string") {
      const parts = geoData.box.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[3]);
    }
    return "";
  });
  const [south, setSouth] = useState<number | string>(() => {
    if (geoData?.box && typeof geoData.box === "string") {
      const parts = geoData.box.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[1]);
    }
    return "";
  });
  const [west, setWest] = useState<number | string>(() => {
    if (geoData?.box && typeof geoData.box === "string") {
      const parts = geoData.box.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[0]);
    }
    return "";
  });
  const [east, setEast] = useState<number | string>(() => {
    if (geoData?.box && typeof geoData.box === "string") {
      const parts = geoData.box.trim().split(/\s+/);
      if (parts.length === 4) return parseFloat(parts[2]);
    }
    return "";
  });

  const [localFileLocation, setLocalFileLocation] = useState(fileLocation);

  // Clear markers helper
  const clearMarkers = () => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  };

  // Clear line layer helper
  const clearLineLayer = () => {
    if (lineLayerIdRef.current && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      if (map.getLayer(lineLayerIdRef.current)) {
        map.removeLayer(lineLayerIdRef.current);
      }
      if (map.getSource(lineLayerIdRef.current)) {
        map.removeSource(lineLayerIdRef.current);
      }
      lineLayerIdRef.current = null;
    }
  };

  // Add line helper (for line mode)
  const addLine = useCallback(
    (map: any, lat1: number, lon1: number, lat2: number, lon2: number) => {
      // Clear existing line
      clearLineLayer();

      const lineId = "dosing-line";
      lineLayerIdRef.current = lineId;

      // Add line as GeoJSON
      map.addSource(lineId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [lon1, lat1],
              [lon2, lat2]
            ]
          }
        }
      });

      map.addLayer({
        id: lineId,
        type: "line",
        source: lineId,
        paint: {
          "line-color": "#228be6",
          "line-width": 3
        }
      });
    },
    []
  );

  // Handle manual coordinate input changes (for line mode)
  const handleLineCoordinateChange = useCallback(
    (
      newLat1: number | string,
      newLon1: number | string,
      newLat2: number | string,
      newLon2: number | string
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
        addLine(mapInstanceRef.current, newLat1, newLon1, newLat2, newLon2);

        // Fit bounds to line
        const bounds = new window.maplibregl.LngLatBounds(
          [newLon1, newLat1],
          [newLon2, newLat2]
        );
        mapInstanceRef.current.fitBounds(bounds, {
          padding: 50,
          duration: 500
        });
      }
    },
    [addLine, mapLoaded]
  );

  // Start draw line selection mode (for line mode)
  const startLineSelection = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    setIsSelecting(true);
    startPointRef.current = null;

    // Clear existing line
    clearLineLayer();

    map.getCanvas().style.cursor = "crosshair";

    const onMapClick = (e: any) => {
      const { lng, lat } = e.lngLat;

      if (!startPointRef.current) {
        // First click - start selection
        startPointRef.current = { lng, lat };
      } else {
        // Second click - complete selection
        const startPt = startPointRef.current;

        // Add final line
        addLine(map, startPt.lat, startPt.lng, lat, lng);

        // Update coordinate states
        setLine1Lat(startPt.lat);
        setLine1Lon(startPt.lng);
        setLine2Lat(lat);
        setLine2Lon(lng);

        // Clean up
        map.off("click", onMapClick);
        map.getCanvas().style.cursor = "";
        setIsSelecting(false);
        startPointRef.current = null;
      }
    };

    map.on("click", onMapClick);
  }, [addLine]);

  // Add bounding box helper (for box mode)
  const addBoundingBox = useCallback(
    (map: any, w: number, s: number, e: number, n: number) => {
      // Remove existing bounding box
      if (map.getSource("dosing-bbox")) {
        if (map.getLayer("dosing-bbox-fill"))
          map.removeLayer("dosing-bbox-fill");
        if (map.getLayer("dosing-bbox-outline"))
          map.removeLayer("dosing-bbox-outline");
        map.removeSource("dosing-bbox");
      }

      // Add bounding box as GeoJSON
      map.addSource("dosing-bbox", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [w, n],
                [e, n],
                [e, s],
                [w, s],
                [w, n]
              ]
            ]
          }
        }
      });

      // Add fill layer
      map.addLayer({
        id: "dosing-bbox-fill",
        type: "fill",
        source: "dosing-bbox",
        paint: {
          "fill-color": "#ff7800",
          "fill-opacity": 0.1
        }
      });

      // Add outline layer
      map.addLayer({
        id: "dosing-bbox-outline",
        type: "line",
        source: "dosing-bbox",
        paint: {
          "line-color": "#ff7800",
          "line-width": 2
        }
      });
    },
    []
  );

  // Handle manual coordinate input changes (for box mode)
  const handleCoordinateChange = useCallback(
    (
      newWest: number | string,
      newSouth: number | string,
      newEast: number | string,
      newNorth: number | string
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
        addBoundingBox(
          mapInstanceRef.current,
          newWest,
          newSouth,
          newEast,
          newNorth
        );
        mapInstanceRef.current.fitBounds(
          [
            [newWest, newSouth],
            [newEast, newNorth]
          ],
          {
            padding: 20,
            duration: 500
          }
        );
      }
    },
    [addBoundingBox, mapLoaded]
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
        markersRef.current.forEach((marker) => marker.remove());
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
          duration: 500
        });
      }
    },
    [mapLoaded]
  );

  // Start draw selection mode (for box mode)
  const startSelection = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    setIsSelecting(true);
    startPointRef.current = null;

    // Remove existing bounding box
    if (map.getSource("dosing-bbox")) {
      if (map.getLayer("dosing-bbox-fill")) map.removeLayer("dosing-bbox-fill");
      if (map.getLayer("dosing-bbox-outline"))
        map.removeLayer("dosing-bbox-outline");
      map.removeSource("dosing-bbox");
    }

    map.getCanvas().style.cursor = "crosshair";

    const onMapClick = (e: any) => {
      const { lng, lat } = e.lngLat;

      if (!startPointRef.current) {
        // First click - start selection
        startPointRef.current = { lng, lat };
      } else {
        // Second click - complete selection
        const startPt = startPointRef.current;
        const w = Math.min(startPt.lng, lng);
        const e = Math.max(startPt.lng, lng);
        const s = Math.min(startPt.lat, lat);
        const n = Math.max(startPt.lat, lat);

        // Add final bounding box
        addBoundingBox(map, w, s, e, n);

        // Update coordinate states
        setWest(w);
        setSouth(s);
        setEast(e);
        setNorth(n);

        // Clean up
        map.off("click", onMapClick);
        map.getCanvas().style.cursor = "";
        setIsSelecting(false);
        startPointRef.current = null;
      }
    };

    map.on("click", onMapClick);
  }, [addBoundingBox]);

  // Initialize map function
  const initializeMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new window.maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-123.0, 47.5],
      zoom: 2
    });

    mapInstanceRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);

      // Load existing box data if in box mode
      if (localMode === "box" && geoData?.box) {
        const parts = geoData.box.trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          const [w, s, e, n] = parts;
          addBoundingBox(map, w, s, e, n);
          map.fitBounds(
            [
              [w, s],
              [e, n]
            ],
            { padding: 50 }
          );
        }
      }

      // Load existing line data if in line mode
      if (localMode === "line" && geoData?.line) {
        const parts = geoData.line.trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          const [lat1, lon1, lat2, lon2] = parts;
          addLine(map, lat1, lon1, lat2, lon2);
          const bounds = new window.maplibregl.LngLatBounds(
            [lon1, lat1],
            [lon2, lat2]
          );
          map.fitBounds(bounds, { padding: 50 });
        }
      }

      // Load existing point data if in point mode
      if (localMode === "point" && geoData?.latitude !== undefined && geoData?.longitude !== undefined) {
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
  }, [localMode, geoData, addBoundingBox, addLine]);

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
          link.href =
            "https://unpkg.com/maplibre-gl@4.5.2/dist/maplibre-gl.css";
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, initializeMap]);

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

    // Clear bounding box visualization
    if (
      mapInstanceRef.current &&
      mapInstanceRef.current.getSource("dosing-bbox")
    ) {
      const map = mapInstanceRef.current;
      if (map.getLayer("dosing-bbox-fill")) map.removeLayer("dosing-bbox-fill");
      if (map.getLayer("dosing-bbox-outline"))
        map.removeLayer("dosing-bbox-outline");
      map.removeSource("dosing-bbox");
    }
  };

  const handleSave = () => {
    if (!localMode) return;

    // Validate box mode requires file location
    if (localMode === "box" && !localFileLocation.trim()) {
      alert("Dosing file location is required");
      return;
    }

    let newGeoData = {};

    if (
      localMode === "point" &&
      typeof pointLat === "number" &&
      typeof pointLon === "number"
    ) {
      newGeoData = {
        latitude: pointLat,
        longitude: pointLon
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
        line: lineString
      };
    } else if (
      localMode === "box" &&
      typeof west === "number" &&
      typeof south === "number" &&
      typeof east === "number" &&
      typeof north === "number"
    ) {
      // Format: "west south east north"
      const boxString = `${west} ${south} ${east} ${north}`;
      newGeoData = {
        box: boxString
      };
    }

    onChange(
      newGeoData,
      localMode === "box" ? localFileLocation : undefined,
      localMode
    );
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
        if (!isSelecting) {
          return "Enter coordinates or 'Draw Selection' by clicking two points on the map to define your line/diffuser.";
        } else {
          return startPointRef.current
            ? "Click second point to complete line"
            : "Click first point to start line";
        }
      case "box":
        if (!isSelecting) {
          return "Enter coordinates or 'Draw Selection' by clicking two points on the map to define your bounding box.";
        } else {
          return startPointRef.current
            ? "Click second point to complete selection"
            : "Click first point to start selection";
        }
      default:
        return "";
    }
  };

  const canSave = () => {
    if (!localMode) return false;
    if (localMode === "point")
      return typeof pointLat === "number" && typeof pointLon === "number";
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
    { value: "line", label: "Line / Diffuser" },
    { value: "box", label: "Provided as a file" }
  ];

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Set Dosing Location"
      size="xl"
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
            placeholder="path/to/dosing_locations.geojson"
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
              border: "1px solid #ccc",
              opacity: !localMode ? 0.5 : 1
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
                backgroundColor: "rgba(255, 255, 255, 0.75)",
                borderRadius: "4px",
                border: "1px solid #ccc",
                padding: "8px",
                pointerEvents: "none"
              }}
            >
              <IconMap
                size={48}
                style={{ marginBottom: "12px", opacity: 0.4 }}
              />
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
                  handleLineCoordinateChange(
                    value,
                    line1Lon,
                    line2Lat,
                    line2Lon
                  );
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
                  handleLineCoordinateChange(
                    line1Lat,
                    value,
                    line2Lat,
                    line2Lon
                  );
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
                  handleLineCoordinateChange(
                    line1Lat,
                    line1Lon,
                    value,
                    line2Lon
                  );
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
                  handleLineCoordinateChange(
                    line1Lat,
                    line1Lon,
                    line2Lat,
                    value
                  );
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
          <Group gap="md" align="flex-start" justify="center">
            <Stack gap="xs">
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
              />
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
              />
            </Stack>
            <Stack gap="xs">
              <NumberInput
                label="°E (max longitude)"
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
              <NumberInput
                label="°W (min longitude)"
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
            </Stack>
          </Group>
        )}

        <Box
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          {localMode === "line" && mapLoaded && (
            <Button
              variant="outline"
              onClick={startLineSelection}
              disabled={isSelecting}
            >
              {isSelecting ? "Drawing..." : "Draw Selection"}
            </Button>
          )}

          {localMode === "box" && mapLoaded && (
            <Button
              variant="outline"
              onClick={startSelection}
              disabled={isSelecting}
            >
              {isSelecting ? "Drawing..." : "Draw Selection"}
            </Button>
          )}

          <Group
            gap="xs"
            style={{
              marginLeft:
                localMode === "line" || localMode === "box" ? undefined : "auto"
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
