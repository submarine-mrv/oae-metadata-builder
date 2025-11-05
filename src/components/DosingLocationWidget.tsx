"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { FieldProps } from "@rjsf/utils";
import {
  Box,
  Text,
  Tooltip,
  ActionIcon,
  Select,
  TextInput,
  Stack
} from "@mantine/core";
import { IconMap, IconEdit } from "@tabler/icons-react";
import DosingLocationMapModal from "./DosingLocationMapModal";

type DosingMode = "point" | "line" | "box";

// Infer mode from formData
function inferMode(formData: any): DosingMode | null {
  const geo = formData?.geo;
  if (!geo) return null;

  if (geo.latitude !== undefined || geo.longitude !== undefined) return "point";
  if (geo.line !== undefined) return "line";
  if (geo.box !== undefined) return "box";

  return null;
}

// Format point for display
function formatPoint(formData: any): string {
  const lat = formData?.geo?.latitude;
  const lon = formData?.geo?.longitude;
  if (lat !== undefined && lon !== undefined) {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
  return "";
}

// Format line for display
function formatLine(formData: any): string {
  const line = formData?.geo?.line;
  if (typeof line === "string" && line.trim()) {
    return line;
  }
  return "";
}

// Format box for display (same as spatial coverage)
function formatBox(formData: any): string {
  const box = formData?.geo?.box;
  if (typeof box === "string" && box.trim()) {
    return box;
  }
  return "";
}

const DosingLocationWidget: React.FC<FieldProps> = (props) => {
  const {
    formData,
    onChange,
    disabled,
    readonly,
    required,
    schema,
    uiSchema,
    rawErrors
  } = props;

  const [selectedMode, setSelectedMode] = useState<DosingMode | null>(
    inferMode(formData)
  );
  const [showMapModal, setShowMapModal] = useState(false);
  const [miniMapLoaded, setMiniMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Update selected mode when formData changes externally
  useEffect(() => {
    const inferred = inferMode(formData);
    if (inferred) {
      setSelectedMode(inferred);
    }
  }, [formData]);

  const hasValidationErrors = rawErrors && rawErrors.length > 0;

  const handleMapDataChange = (
    newGeoData: any,
    fileLocation?: string,
    newMode?: DosingMode
  ) => {
    const newData = {
      ...formData,
      geo: newGeoData
    };

    // Update selected mode if provided
    if (newMode) {
      setSelectedMode(newMode);
    }

    // Only include file location for box mode
    if (fileLocation !== undefined) {
      newData.dosing_location_file = fileLocation;
    } else {
      newData.dosing_location_file = undefined;
    }

    onChange(newData);
  };

  // Get display text based on mode
  const getDisplayText = () => {
    if (!selectedMode) return "Click to set dosing location";

    switch (selectedMode) {
      case "point":
        return "Click to set point location";
      case "line":
        return "Click to set line/diffuser";
      case "box":
        return "Click to set bounding box";
      default:
        return "Click to set dosing location";
    }
  };

  // Get coordinate display
  const getCoordinateDisplay = () => {
    if (!selectedMode) return null;

    switch (selectedMode) {
      case "point":
        const point = formatPoint(formData);
        return point || null;
      case "line":
        const line = formatLine(formData);
        return line || null;
      case "box":
        const box = formatBox(formData);
        return box || null;
      default:
        return null;
    }
  };

  // Initialize mini map preview
  const initializeMiniMap = useCallback(() => {
    if (!mapRef.current || miniMapLoaded) return;

    try {
      const map = new window.maplibregl.Map({
        container: mapRef.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [-123.0, 47.5],
        zoom: 2,
        interactive: false,
        attributionControl: false
      });

      mapInstanceRef.current = map;

      map.on("load", () => {
        setMiniMapLoaded(true);
      });
    } catch (error) {
      console.error("Error initializing mini map:", error);
    }
  }, [miniMapLoaded]);

  useEffect(() => {
    // Always load the map preview
    if (typeof window === "undefined" || miniMapLoaded) return;

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
        if (mapRef.current && !miniMapLoaded) {
          initializeMiniMap();
        }
      });
    };

    loadAndInitialize();
  }, [initializeMiniMap, miniMapLoaded]);

  // Update mini map visualization when formData changes
  useEffect(() => {
    if (!mapInstanceRef.current || !miniMapLoaded || !selectedMode) return;
    const map = mapInstanceRef.current;

    // Clear existing visualizations
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (map.getSource("dosing-line")) {
      if (map.getLayer("dosing-line")) map.removeLayer("dosing-line");
      map.removeSource("dosing-line");
    }
    if (map.getSource("dosing-bbox")) {
      if (map.getLayer("dosing-bbox-fill")) map.removeLayer("dosing-bbox-fill");
      if (map.getLayer("dosing-bbox-outline"))
        map.removeLayer("dosing-bbox-outline");
      map.removeSource("dosing-bbox");
    }

    // Add visualization based on mode
    if (selectedMode === "point") {
      const lat = formData?.geo?.latitude;
      const lon = formData?.geo?.longitude;
      if (lat !== undefined && lon !== undefined) {
        const marker = new window.maplibregl.Marker({ color: "#228be6" })
          .setLngLat([lon, lat])
          .addTo(map);
        markerRef.current = marker;
        map.flyTo({ center: [lon, lat], zoom: 8, duration: 0 });
      }
    } else if (selectedMode === "line") {
      const line = formData?.geo?.line;
      if (typeof line === "string" && line.trim()) {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          const [lat1, lon1, lat2, lon2] = parts;
          map.addSource("dosing-line", {
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
            id: "dosing-line",
            type: "line",
            source: "dosing-line",
            paint: { "line-color": "#228be6", "line-width": 3 }
          });
          const bounds = new window.maplibregl.LngLatBounds(
            [lon1, lat1],
            [lon2, lat2]
          );
          map.fitBounds(bounds, { padding: 20, duration: 0 });
        }
      }
    } else if (selectedMode === "box") {
      const box = formData?.geo?.box;
      if (typeof box === "string" && box.trim()) {
        const parts = box.trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          const [west, south, east, north] = parts;
          map.addSource("dosing-bbox", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [west, north],
                    [east, north],
                    [east, south],
                    [west, south],
                    [west, north]
                  ]
                ]
              }
            }
          });
          map.addLayer({
            id: "dosing-bbox-fill",
            type: "fill",
            source: "dosing-bbox",
            paint: { "fill-color": "#ff7800", "fill-opacity": 0.1 }
          });
          map.addLayer({
            id: "dosing-bbox-outline",
            type: "line",
            source: "dosing-bbox",
            paint: { "line-color": "#ff7800", "line-width": 2 }
          });
          map.fitBounds(
            [
              [west, south],
              [east, north]
            ],
            { padding: 20, duration: 0 }
          );
        }
      }
    }
  }, [formData, selectedMode, miniMapLoaded]);

  const coordinateDisplay = getCoordinateDisplay();

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500} mb={4}>
        Dosing Location{" "}
        {required && (
          <Text component="span" c="red">
            *
          </Text>
        )}
      </Text>
      <Box
        style={{
          border: hasValidationErrors ? "2px solid red" : "1px solid #ccc",
          borderRadius: "4px",
          padding: "8px",
          cursor: disabled || readonly ? "default" : "pointer",
          position: "relative",
          height: "300px"
        }}
        onClick={() => {
          if (!disabled && !readonly) {
            setShowMapModal(true);
          }
        }}
      >
        {/* Mini map preview */}
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "4px",
            position: "absolute",
            top: 0,
            left: 0
          }}
        />

        {/* Overlay with text - only show when no location is set */}
        {!coordinateDisplay && (
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
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              borderRadius: "4px",
              padding: "8px"
            }}
          >
            <IconMap size={32} style={{ marginBottom: "8px", opacity: 0.6 }} />
            <Text size="sm" ta="center" c="dimmed">
              {getDisplayText()}
            </Text>
          </Box>
        )}

        {/* Edit icon */}
        {!disabled && !readonly && (
          <Tooltip label="Edit location">
            <ActionIcon
              variant="filled"
              color="blue"
              size="md"
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                zIndex: 10
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowMapModal(true);
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>

      {/* Coordinate display */}
      {coordinateDisplay && (
        <Text size="xs" c="dimmed" mt={4} style={{ fontFamily: "monospace" }}>
          {coordinateDisplay}
        </Text>
      )}

      {/* Map Modal */}
      {showMapModal && (
        <DosingLocationMapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          geoData={formData?.geo || {}}
          fileLocation={formData?.dosing_location_file || ""}
          mode={selectedMode}
          onChange={handleMapDataChange}
        />
      )}
    </Stack>
  );
};

export default DosingLocationWidget;
