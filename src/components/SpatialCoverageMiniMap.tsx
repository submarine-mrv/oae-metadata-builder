"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { FieldProps } from "@rjsf/utils";
import { Box, Text, Tooltip, ActionIcon } from "@mantine/core";
import { IconMap, IconEdit } from "@tabler/icons-react";
import MapBoundingBoxSelectorProper from "./MapBoundingBoxSelectorProper";

// parse "W S E N" string from nested object
function readBox(formData: any): string {
  const v = formData?.geo?.box;
  return typeof v === "string" ? v : "";
}

// write nested object from "W S E N" string
function writeBox(s: string): any {
  const trimmed = s.trim();
  if (!trimmed) return null;
  return { geo: { box: trimmed } };
}

// validate spatial bounds according to WKT conventions
function validateSpatialBounds(boxString: string): string | null {
  const trimmed = boxString.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 4) {
    return "Must contain exactly 4 numbers: W S E N";
  }

  const [west, south, east, north] = parts.map(Number);

  if (
    parts.some((part, i) => !Number.isFinite([west, south, east, north][i]))
  ) {
    return "All values must be valid numbers";
  }

  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return "Longitude (W, E) must be between -180 and 180";
  }

  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return "Latitude (S, N) must be between -90 and 90";
  }

  if (east <= west) {
    return "East longitude must be greater than West longitude";
  }

  if (north <= south) {
    return "North latitude must be greater than South latitude";
  }

  return null;
}

const SpatialCoverageMiniMap: React.FC<FieldProps> = (props) => {
  const {
    idSchema,
    formData,
    onChange,
    disabled,
    readonly,
    required,
    schema,
    uiSchema
  } = props;

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [value, setValue] = useState<string>(readBox(formData));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [miniMapLoaded, setMiniMapLoaded] = useState(false);

  const label = uiSchema?.["ui:title"] ?? schema?.title ?? "Spatial coverage";

  useEffect(() => {
    const boxValue = readBox(formData);
    setValue(boxValue);
    setValidationError(validateSpatialBounds(boxValue));
  }, [formData]);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    const error = validateSpatialBounds(newValue);
    setValidationError(error);
    const newData = writeBox(newValue);
    onChange(newData);
  };

  // Initialize mini map when component mounts
  const initializeMiniMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current || !window.maplibregl) return;

    const map = new window.maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-123.0, 47.5],
      zoom: 2,
      interactive: false, // Make it non-interactive for preview
      attributionControl: false
    });

    mapInstanceRef.current = map;

    map.on("load", () => {
      setMiniMapLoaded(true);

      // Add bounding box if we have coordinates
      if (value.trim()) {
        const parts = value.trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          const [west, south, east, north] = parts;
          addBoundingBox(map, west, south, east, north);
          map.fitBounds(
            [
              [west, south],
              [east, north]
            ],
            {
              padding: 20,
              duration: 0
            }
          );
        }
      }
    });
  }, [value]);

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

    // Add bounding box as GeoJSON
    map.addSource("bbox", {
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

  // Load MapLibre and initialize mini map
  useEffect(() => {
    const loadAndInit = async () => {
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

      requestAnimationFrame(() => {
        if (mapRef.current && !mapInstanceRef.current) {
          initializeMiniMap();
        }
      });
    };

    loadAndInit();
  }, [initializeMiniMap]);

  // Update mini map when value changes
  useEffect(() => {
    if (mapInstanceRef.current && miniMapLoaded && value.trim()) {
      const parts = value.trim().split(/\s+/).map(Number);
      if (parts.length === 4) {
        const [west, south, east, north] = parts;
        addBoundingBox(mapInstanceRef.current, west, south, east, north);
        mapInstanceRef.current.fitBounds(
          [
            [west, south],
            [east, north]
          ],
          {
            padding: 20,
            duration: 500
          }
        );
      }
    } else if (mapInstanceRef.current && miniMapLoaded && !value.trim()) {
      // Remove bounding box if no value
      if (mapInstanceRef.current.getSource("bbox")) {
        mapInstanceRef.current.removeLayer("bbox-fill");
        mapInstanceRef.current.removeLayer("bbox-outline");
        mapInstanceRef.current.removeSource("bbox");
      }
      // Reset to default view
      mapInstanceRef.current.flyTo({
        center: [-123.0, 47.5],
        zoom: 2,
        duration: 500
      });
    }
  }, [value, miniMapLoaded]);

  return (
    <>
      <Box>
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px"
          }}
        >
          <Text size="sm" fw={500}>
            {label}{" "}
            {required && (
              <Text component="span" c="red">
                *
              </Text>
            )}
          </Text>
          <Tooltip label="Click to open map editor">
            <ActionIcon
              variant="subtle"
              size="xs"
              onClick={() => setShowMapModal(true)}
              disabled={disabled || readonly}
              style={{ cursor: "pointer" }}
            >
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
        </Box>

        <Box
          onClick={() => !disabled && !readonly && setShowMapModal(true)}
          style={{
            width: "100%",
            height: "300px",
            border: validationError ? "2px solid #fa5252" : "1px solid #ced4da",
            borderRadius: "4px",
            cursor: disabled || readonly ? "default" : "pointer",
            position: "relative",
            overflow: "hidden",
            backgroundColor: "#f8f9fa"
          }}
        >
          <div
            ref={mapRef}
            style={{
              width: "100%",
              height: "100%"
            }}
          />

          {/* Overlay for click indication */}
          {!disabled && !readonly && (
            <Box
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                transition: "opacity 0.2s",
                pointerEvents: "none"
              }}
              className="map-overlay"
            >
              <Box
                style={{
                  backgroundColor: "rgba(0,0,0,0.7)",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <IconMap size={16} />
                Click to edit
              </Box>
            </Box>
          )}
        </Box>
        <Text size="xs" c="dimmed" mt={4} style={{ fontFamily: "monospace" }}>
          {value || "Click the map to set bounding box"}
        </Text>
      </Box>

      <MapBoundingBoxSelectorProper
        opened={showMapModal}
        onClose={() => setShowMapModal(false)}
        onSelect={(bounds) => {
          handleValueChange(bounds);
          setShowMapModal(false);
        }}
        initialBounds={value}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .map-overlay:hover {
          opacity: 1 !important;
        }
      `
        }}
      />
    </>
  );
};

export default SpatialCoverageMiniMap;
