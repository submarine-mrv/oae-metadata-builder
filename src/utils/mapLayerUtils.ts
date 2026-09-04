/**
 * Map Layer Utilities - Reusable functions for MapLibre GL map visualizations
 *
 * Used by SpatialCoverageField, SpatialCoverageMapModal, DosingLocationField and
 * DosingLocationMapModal.
 *
 * `add*` creates the source and layers. `set*` updates an existing source's data
 * in place and is what the drag-to-draw preview uses — re-adding layers on every
 * mousemove flickers.
 */

import {
  adjustEastForAntimeridian,
  DEGREES_IN_CIRCLE,
  MAX_LONGITUDE,
  MIN_LONGITUDE,
} from "@/utils/spatialUtils";

// Layer style configurations
export const BBOX_STYLES = {
  fill: {
    color: "#ff7800",
    opacity: 0.1,
  },
  outline: {
    color: "#ff7800",
    width: 2,
  },
} as const;

export const LINE_STYLES = {
  color: "#228be6",
  width: 3,
} as const;

export const MARKER_COLOR = "#228be6";

/** GeoJSON Feature for a bounding box, with the antimeridian-adjusted east edge. */
function boundingBoxFeature(
  west: number,
  south: number,
  east: number,
  north: number,
  handleAntimeridian = true,
) {
  const renderEast = handleAntimeridian ? adjustEastForAntimeridian(west, east) : east;
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [west, north],
          [renderEast, north],
          [renderEast, south],
          [west, south],
          [west, north],
        ],
      ],
    },
  };
}

/**
 * Shift `to` by a full turn when the direct path from `from` is longer than
 * half the globe, so a segment across the antimeridian is expressed the short
 * way. Rendering and camera fitting must both use this, or the line is drawn
 * one way and framed the other.
 */
export function unwrapLongitudeTowards(from: number, to: number): number {
  const delta = to - from;
  if (delta > MAX_LONGITUDE) return to - DEGREES_IN_CIRCLE;
  if (delta < MIN_LONGITUDE) return to + DEGREES_IN_CIRCLE;
  return to;
}

/**
 * Southwest/northeast corners framing a two-point line, for `fitBounds`.
 *
 * `LngLatBounds` wants the corners in that order, so the endpoints are sorted
 * rather than passed through; and the far longitude is unwrapped first, so a
 * line across the antimeridian is framed the short way it is drawn.
 */
export function lineBounds(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): [[number, number], [number, number]] {
  const farLon = unwrapLongitudeTowards(lon1, lon2);
  return [
    [Math.min(lon1, farLon), Math.min(lat1, lat2)],
    [Math.max(lon1, farLon), Math.max(lat1, lat2)],
  ];
}

/**
 * GeoJSON Feature for a two-point line.
 *
 * Endpoints are stored normalized to [-180, 180], which makes a line that
 * crosses the antimeridian look like the long way round (170° to -170° reads as
 * 340° of travel, not 20°). Unwrap the far end so the short route is drawn.
 */
function lineFeature(lat1: number, lon1: number, lat2: number, lon2: number) {
  const renderLon2 = unwrapLongitudeTowards(lon1, lon2);

  return {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: [
        [lon1, lat1],
        [renderLon2, lat2],
      ],
    },
  };
}

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
 * // Basic usage with default source ID "bbox"
 * addBoundingBox(map, -123.5, 47.2, -122.0, 47.8);
 *
 * // With custom source ID for multiple bounding boxes
 * addBoundingBox(map, west, south, east, north, { sourceId: "custom-bbox" });
 * ```
 */
export function addBoundingBox(
  map: any,
  west: number,
  south: number,
  east: number,
  north: number,
  options: BoundingBoxOptions = {},
): void {
  const {
    sourceId = "bbox",
    fillLayerId = `${sourceId}-fill`,
    outlineLayerId = `${sourceId}-outline`,
    handleAntimeridian = true,
  } = options;

  // Remove existing layers and source
  removeBoundingBox(map, { sourceId, fillLayerId, outlineLayerId });

  map.addSource(sourceId, {
    type: "geojson",
    data: boundingBoxFeature(west, south, east, north, handleAntimeridian),
  });

  // Add fill layer
  map.addLayer({
    id: fillLayerId,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": BBOX_STYLES.fill.color,
      "fill-opacity": BBOX_STYLES.fill.opacity,
    },
  });

  // Add outline layer
  map.addLayer({
    id: outlineLayerId,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": BBOX_STYLES.outline.color,
      "line-width": BBOX_STYLES.outline.width,
    },
  });
}

/**
 * Remove a bounding box visualization from a MapLibre map
 *
 * @param map - MapLibre map instance
 * @param options - Optional configuration for layer IDs
 */
export function removeBoundingBox(map: any, options: BoundingBoxOptions = {}): void {
  const {
    sourceId = "bbox",
    fillLayerId = `${sourceId}-fill`,
    outlineLayerId = `${sourceId}-outline`,
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
 * Update an existing bounding box's geometry in place, adding it if absent.
 *
 * Used for the drag-to-draw preview: `addBoundingBox` tears down and rebuilds a
 * source plus two layers, which flickers when called on every mousemove.
 */
export function setBoundingBoxData(
  map: any,
  west: number,
  south: number,
  east: number,
  north: number,
  options: BoundingBoxOptions = {},
): void {
  const { sourceId = "bbox", handleAntimeridian = true } = options;
  const source = map.getSource(sourceId);
  if (!source) {
    addBoundingBox(map, west, south, east, north, options);
    return;
  }
  source.setData(boundingBoxFeature(west, south, east, north, handleAntimeridian));
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
  options: LineOptions = {},
): void {
  const { sourceId = "line", layerId = sourceId } = options;

  // Remove existing line
  removeLine(map, options);

  map.addSource(sourceId, {
    type: "geojson",
    data: lineFeature(lat1, lon1, lat2, lon2),
  });

  // Add line layer
  map.addLayer({
    id: layerId,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": LINE_STYLES.color,
      "line-width": LINE_STYLES.width,
    },
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
 * Update an existing line's geometry in place, adding it if absent.
 * Counterpart to `setBoundingBoxData` for line-mode drawing.
 */
export function setLineData(
  map: any,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  options: LineOptions = {},
): void {
  const { sourceId = "line" } = options;
  const source = map.getSource(sourceId);
  if (!source) {
    addLine(map, lat1, lon1, lat2, lon2, options);
    return;
  }
  source.setData(lineFeature(lat1, lon1, lat2, lon2));
}

/**
 * Hide every text layer in the basemap style.
 *
 * The preview maps carry a "click to set…" prompt over the tiles, and country
 * and sea names underneath it make that prompt hard to read. The full modal
 * maps keep their labels; only the previews call this.
 */
export function hideLabelLayers(map: any): void {
  const layers: Array<{ id: string; type: string }> = map.getStyle?.()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type === "symbol") map.setLayoutProperty(layer.id, "visibility", "none");
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
  options: { padding?: number; duration?: number } = {},
): void {
  const { padding = 20, duration = 500 } = options;
  const fitEast = adjustEastForAntimeridian(west, east);

  map.fitBounds(
    [
      [west, south],
      [fitEast, north],
    ],
    { padding, duration },
  );
}

/**
 * Parse a bounding box string "S W N E" (minLat minLon maxLat maxLon) into coordinate values.
 * Per science-on-schema.org: https://github.com/ESIPFed/science-on-schema.org/blob/main/guides/Dataset.md#spatial-coverage
 *
 * @param boundsString - Space-separated bounds string: "minLat minLon maxLat maxLon"
 * @returns Parsed coordinates or null if invalid
 */
export function parseBoundsString(
  boundsString: string,
): { west: number; south: number; east: number; north: number } | null {
  if (!boundsString?.trim()) return null;

  const parts = boundsString.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }

  const [south, west, north, east] = parts;
  return { west, south, east, north };
}

/**
 * Format coordinates into a bounding box string "S W N E" (minLat minLon maxLat maxLon).
 * Per science-on-schema.org: https://github.com/ESIPFed/science-on-schema.org/blob/main/guides/Dataset.md#spatial-coverage
 *
 * @param west - Western longitude
 * @param south - Southern latitude
 * @param east - Eastern longitude
 * @param north - Northern latitude
 * @param precision - Decimal places (default: 6)
 * @returns Formatted bounds string: "minLat minLon maxLat maxLon"
 */
export function formatBoundsString(
  west: number,
  south: number,
  east: number,
  north: number,
  precision = 6,
): string {
  return `${south.toFixed(precision)} ${west.toFixed(precision)} ${north.toFixed(precision)} ${east.toFixed(precision)}`;
}
