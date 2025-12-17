"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { FieldProps } from "@rjsf/utils";
import { Box, Text, Tooltip, ActionIcon } from "@mantine/core";
import { IconMap, IconEdit } from "@tabler/icons-react";
import MapBoundingBoxSelectorProper from "./MapBoundingBoxSelectorProper";
import { validateSpatialBounds } from "@/utils/spatialUtils";
import {
  addBoundingBox,
  removeBoundingBox,
  fitBoundsWithAntimeridian,
  parseBoundsString
} from "@/utils/mapLayerUtils";
import { useMapLibreLoader } from "@/hooks/useMapLibreLoader";
import {
  MAP_TILE_STYLE,
  DEFAULT_MAP_CENTER,
  DEFAULT_MINI_MAP_ZOOM
} from "@/config/maps";

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
  const mapInstanceRef = useRef<any>(null);
  const [value, setValue] = useState<string>(readBox(formData));
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check if there are RJSF validation errors
  const hasValidationErrors = rawErrors && rawErrors.length > 0;
  const [showMapModal, setShowMapModal] = useState(false);
  const [miniMapLoaded, setMiniMapLoaded] = useState(false);

  // Load MapLibre using the shared hook
  const { isLoaded: mapLibreLoaded } = useMapLibreLoader();

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
    // v6: Pass data with absolute path to this field
    onChange(newData, props.fieldPathId.path, undefined, props.fieldPathId.$id);
  };

  // Initialize mini map when component mounts
  const initializeMiniMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current || !window.maplibregl) return;

    const map = new window.maplibregl.Map({
      container: mapRef.current,
      style: MAP_TILE_STYLE,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MINI_MAP_ZOOM,
      interactive: false, // Make it non-interactive for preview
      attributionControl: false
    });

    mapInstanceRef.current = map;

    map.on("load", () => {
      setMiniMapLoaded(true);

      // Add bounding box if we have coordinates
      const bounds = parseBoundsString(value);
      if (bounds) {
        const { west, south, east, north } = bounds;
        addBoundingBox(map, west, south, east, north);
        fitBoundsWithAntimeridian(map, west, south, east, north, { padding: 20, duration: 0 });
      }
    });
  }, [value]);

  // Initialize map when MapLibre is loaded
  useEffect(() => {
    if (!mapLibreLoaded) return;

    requestAnimationFrame(() => {
      if (mapRef.current && !mapInstanceRef.current) {
        initializeMiniMap();
      }
    });
  }, [mapLibreLoaded, initializeMiniMap]);

  // Update mini map when value changes
  useEffect(() => {
    if (!mapInstanceRef.current || !miniMapLoaded) return;

    const map = mapInstanceRef.current;
    const bounds = parseBoundsString(value);

    if (bounds) {
      const { west, south, east, north } = bounds;
      addBoundingBox(map, west, south, east, north);
      fitBoundsWithAntimeridian(map, west, south, east, north, { padding: 20, duration: 500 });
    } else {
      // Remove bounding box if no value
      removeBoundingBox(map);
      // Reset to default view
      map.flyTo({
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MINI_MAP_ZOOM,
        duration: 500
      });
    }
  }, [value, miniMapLoaded]);

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
