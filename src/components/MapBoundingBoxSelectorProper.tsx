"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Modal, Button, Text, Box, Stack } from "@mantine/core";

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
  const mapInstanceRef = useRef<any>(null);
  const startPointRef = useRef<{ lng: number; lat: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<string>(initialBounds);
  const [startPoint, setStartPoint] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [_, setBoundingBox] = useState<any>(null);

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.maplibregl || mapInstanceRef.current) return;

    const map = new window.maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-123.0, 47.5], // Pacific Northwest (Seattle area)
      zoom: 6
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
          // Smooth zoom to bounds with animation
          map.fitBounds(
            [
              [west, south],
              [east, north]
            ],
            {
              padding: 50
              // Remove duration: 0 to restore smooth animation
            }
          );
          setCurrentBounds(initialBounds);
        }
      }
    });

    return map;
  }, [initialBounds]);

  // Load MapLibre and initialize map when modal opens
  useEffect(() => {
    if (!opened) return;

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
  }, [opened, initializeMap]);

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

    setBoundingBox({ west, south, east, north });
  };

  const startSelection = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

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
        const west = Math.min(startPt.lng, lng);
        const east = Math.max(startPt.lng, lng);
        const south = Math.min(startPt.lat, lat);
        const north = Math.max(startPt.lat, lat);

        // Add final bounding box
        addBoundingBox(map, west, south, east, north);

        // Format as "W S E N"
        const boundsString = `${west.toFixed(6)} ${south.toFixed(
          6
        )} ${east.toFixed(6)} ${north.toFixed(6)}`;
        setCurrentBounds(boundsString);

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
      setBoundingBox(null);
    }
  }, [opened, initialBounds]);

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title="Select Bounding Box"
      size="xl"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {!mapLoaded
            ? "Loading map..."
            : !isSelecting
            ? "Click 'Start Selection' then click two points on the map to define your bounding box."
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

        {currentBounds && (
          <Text size="sm" style={{ fontFamily: "monospace" }}>
            Current bounds: {currentBounds}
          </Text>
        )}

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
              {isSelecting ? "Selecting..." : "Start Selection"}
            </Button>
          )}

          <Box style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!currentBounds}>
              Confirm
            </Button>
          </Box>
        </Box>
      </Stack>
    </Modal>
  );
};

export default MapBoundingBoxSelectorProper;
