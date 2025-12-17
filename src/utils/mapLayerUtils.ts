/**
 * Map Layer Utilities - Reusable functions for MapLibre GL map visualizations
 *
 * Consolidates the repeated map layer patterns used across:
 * - SpatialCoverageMiniMap
 * - MapBoundingBoxSelectorProper
 * - DosingLocationMapModal
 * - DosingLocationWidget
 */

import { adjustEastForAntimeridian } from "@/utils/spatialUtils";

// Layer style configurations
export const BBOX_STYLES = {
  fill: {
    color: "#ff7800",
    opacity: 0.1
  },
  outline: {
    color: "#ff7800",
    width: 2
  }
} as const;

export const LINE_STYLES = {
  color: "#228be6",
  width: 3
} as const;

export const MARKER_COLOR = "#228be6";

interface BoundingBoxOptions {
  sourceId?: string;
  fillLayerId?: string;
  outlineLayerId?: string;
  handleAntimeridian?: boolean;
}

/**
 * Add a bounding box visualization to a MapLibre map
 *
 * @param map - MapLibre map instance
 * @param west - Western longitude boundary
 * @param south - Southern latitude boundary
 * @param east - Eastern longitude boundary
 * @param north - Northern latitude boundary
 * @param options - Optional configuration for layer IDs and antimeridian handling
 *
 * @example
 * ```tsx
 * addBoundingBox(map, -123.5, 47.2, -122.0, 47.8);
 * addBoundingBox(map, west, south, east, north, { sourceId: "dosing-bbox" });
 * ```
 */
export function addBoundingBox(
  map: any,
  west: number,
  south: number,
  east: number,
  north: number,
  options: BoundingBoxOptions = {}
): void {
  const {
    sourceId = "bbox",
    fillLayerId = `${sourceId}-fill`,
    outlineLayerId = `${sourceId}-outline`,
    handleAntimeridian = true
  } = options;

  // Remove existing layers and source
  removeBoundingBox(map, { sourceId, fillLayerId, outlineLayerId });

  // Handle antimeridian crossing for rendering
  const renderWest = west;
  const renderEast = handleAntimeridian
    ? adjustEastForAntimeridian(west, east)
    : east;

  // Add bounding box as GeoJSON source
  map.addSource(sourceId, {
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
    id: fillLayerId,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": BBOX_STYLES.fill.color,
      "fill-opacity": BBOX_STYLES.fill.opacity
    }
  });

  // Add outline layer
  map.addLayer({
    id: outlineLayerId,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": BBOX_STYLES.outline.color,
      "line-width": BBOX_STYLES.outline.width
    }
  });
}

/**
 * Remove a bounding box visualization from a MapLibre map
 *
 * @param map - MapLibre map instance
 * @param options - Optional configuration for layer IDs
 */
export function removeBoundingBox(
  map: any,
  options: BoundingBoxOptions = {}
): void {
  const {
    sourceId = "bbox",
    fillLayerId = `${sourceId}-fill`,
    outlineLayerId = `${sourceId}-outline`
  } = options;

  if (map.getSource(sourceId)) {
    if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
    if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
    map.removeSource(sourceId);
  }
}

interface LineOptions {
  sourceId?: string;
  layerId?: string;
}

/**
 * Add a line visualization to a MapLibre map
 *
 * @param map - MapLibre map instance
 * @param lat1 - Start point latitude
 * @param lon1 - Start point longitude
 * @param lat2 - End point latitude
 * @param lon2 - End point longitude
 * @param options - Optional configuration for layer IDs
 */
export function addLine(
  map: any,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  options: LineOptions = {}
): void {
  const { sourceId = "line", layerId = sourceId } = options;

  // Remove existing line
  removeLine(map, options);

  // Add line as GeoJSON source
  map.addSource(sourceId, {
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

  // Add line layer
  map.addLayer({
    id: layerId,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": LINE_STYLES.color,
      "line-width": LINE_STYLES.width
    }
  });
}

/**
 * Remove a line visualization from a MapLibre map
 *
 * @param map - MapLibre map instance
 * @param options - Optional configuration for layer IDs
 */
export function removeLine(map: any, options: LineOptions = {}): void {
  const { sourceId = "line", layerId = sourceId } = options;

  if (map.getSource(sourceId)) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    map.removeSource(sourceId);
  }
}

/**
 * Fit map bounds with antimeridian handling
 *
 * @param map - MapLibre map instance
 * @param west - Western longitude boundary
 * @param south - Southern latitude boundary
 * @param east - Eastern longitude boundary
 * @param north - Northern latitude boundary
 * @param options - MapLibre fitBounds options
 */
export function fitBoundsWithAntimeridian(
  map: any,
  west: number,
  south: number,
  east: number,
  north: number,
  options: { padding?: number; duration?: number } = {}
): void {
  const { padding = 20, duration = 500 } = options;
  const fitEast = adjustEastForAntimeridian(west, east);

  map.fitBounds(
    [
      [west, south],
      [fitEast, north]
    ],
    { padding, duration }
  );
}

/**
 * Parse a bounding box string "W S E N" into coordinate values
 *
 * @param boundsString - Space-separated bounds string
 * @returns Parsed coordinates or null if invalid
 */
export function parseBoundsString(
  boundsString: string
): { west: number; south: number; east: number; north: number } | null {
  if (!boundsString?.trim()) return null;

  const parts = boundsString.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }

  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

/**
 * Format coordinates into a bounding box string "W S E N"
 *
 * @param west - Western longitude
 * @param south - Southern latitude
 * @param east - Eastern longitude
 * @param north - Northern latitude
 * @param precision - Decimal places (default: 6)
 * @returns Formatted bounds string
 */
export function formatBoundsString(
  west: number,
  south: number,
  east: number,
  north: number,
  precision = 6
): string {
  return `${west.toFixed(precision)} ${south.toFixed(precision)} ${east.toFixed(precision)} ${north.toFixed(precision)}`;
}
