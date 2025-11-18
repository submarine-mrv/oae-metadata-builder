"use client";

import React, { useState, useRef, useEffect } from "react";
import type { FieldProps } from "@rjsf/utils";
import { Box, Text, Tooltip, ActionIcon } from "@mantine/core";
import { IconMap, IconEdit } from "@tabler/icons-react";
import MapBoundingBoxSelectorProper from "./MapBoundingBoxSelectorProper";
import {
  validateSpatialBounds,
  adjustEastForAntimeridian
} from "@/utils/spatialUtils";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MINI_MAP_ZOOM
} from "@/config/maps";
import { useMapLibreGL } from "@/hooks/useMapLibreGL";

// parse "W S E N" string from nested object
function readBox(formData: any): string {
  const v = formData?.geo?.box;
  return typeof v === "string" ? v : "";
}

// write nested object from "W S E N" string
function writeBox(s: string): any {
  const trimmed = s.trim();
  if (!trimmed) return undefined; // Return undefined instead of null to avoid empty objects
  return { geo: { box: trimmed } };
}

const SpatialCoverageMiniMap: React.FC<FieldProps> = (props) => {
  const { formData, onChange, disabled, readonly, required, schema, uiSchema, rawErrors } =
    props;

  const mapRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string>(readBox(formData));
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check if there are RJSF validation errors
  const hasValidationErrors = rawErrors && rawErrors.length > 0;
  const [showMapModal, setShowMapModal] = useState(false);

  // Use the MapLibre hook for map initialization
  const { mapInstance, isLoaded: miniMapLoaded } = useMapLibreGL(mapRef, {
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_MINI_MAP_ZOOM,
    interactive: false
  }, true);

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

  // Load initial data when map is ready
  useEffect(() => {
    if (!mapInstance || !miniMapLoaded) return;

    // Add bounding box if we have coordinates
    if (value.trim()) {
      const parts = value.trim().split(/\s+/).map(Number);
      if (parts.length === 4) {
        const [west, south, east, north] = parts;
        addBoundingBox(mapInstance, west, south, east, north);
        // Handle antimeridian for fitBounds
        const fitEast = adjustEastForAntimeridian(west, east);
        mapInstance.fitBounds(
          [
            [west, south],
            [fitEast, north]
          ],
          {
            padding: 20,
            duration: 0
          }
        );
      }
    }
  }, [mapInstance, miniMapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Update mini map when value changes
  useEffect(() => {
    if (mapInstance && miniMapLoaded && value.trim()) {
      const parts = value.trim().split(/\s+/).map(Number);
      if (parts.length === 4) {
        const [west, south, east, north] = parts;
        addBoundingBox(mapInstance, west, south, east, north);
        // Handle antimeridian for fitBounds
        const fitEast = adjustEastForAntimeridian(west, east);
        mapInstance.fitBounds(
          [
            [west, south],
            [fitEast, north]
          ],
          {
            padding: 20,
            duration: 500
          }
        );
      }
    } else if (mapInstance && miniMapLoaded && !value.trim()) {
      // Remove bounding box if no value
      if (mapInstance.getSource("bbox")) {
        mapInstance.removeLayer("bbox-fill");
        mapInstance.removeLayer("bbox-outline");
        mapInstance.removeSource("bbox");
      }
      // Reset to default view
      mapInstance.flyTo({
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MINI_MAP_ZOOM,
        duration: 500
      });
    }
  }, [value, miniMapLoaded, mapInstance]);

  return (
    <>
      <Box>
        <Text size="sm" fw={500} mb={4}>
          {label}{" "}
          {required && (
            <Text component="span" c="red">
              *
            </Text>
          )}
        </Text>

        <Box
          onClick={() => !disabled && !readonly && setShowMapModal(true)}
          style={{
            width: "100%",
            height: "300px",
            border: (validationError || hasValidationErrors) ? "2px solid #fa5252" : "1px solid #ced4da",
            borderRadius: "4px",
            cursor: disabled || readonly ? "default" : "pointer",
            position: "relative",
            overflow: "hidden",
            backgroundColor: "#f8f9fa"
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

          {/* Overlay with text when no spatial coverage is set */}
          {!value.trim() && (
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
                Click to set spatial coverage
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
        {/* Display validation errors or placeholder text */}
        {hasValidationErrors ? (
          <Text size="sm" c="red" mt={4}>
            Spatial Coverage is required. Click the map to set bounding box
          </Text>
        ) : (
          <Text size="xs" c="dimmed" mt={4} style={{ fontFamily: "monospace" }}>
            {value || "Click the map to set bounding box"}
          </Text>
        )}
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
    </>
  );
};

export default SpatialCoverageMiniMap;
