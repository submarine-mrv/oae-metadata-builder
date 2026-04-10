/**
 * Utility functions for spatial coordinate handling and validation
 */

// Constants
export const DEGREES_IN_CIRCLE = 360;
export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;

/**
 * Normalizes a longitude value to the -180 to 180 range
 * @param lng - Longitude value to normalize
 * @returns Normalized longitude in [-180, 180] range
 */
export function normalizeLongitude(lng: number): number {
  let normalized = lng % DEGREES_IN_CIRCLE;
  if (normalized > MAX_LONGITUDE) normalized -= DEGREES_IN_CIRCLE;
  if (normalized < MIN_LONGITUDE) normalized += DEGREES_IN_CIRCLE;
  return normalized;
}

/**
 * Adjusts east coordinate for antimeridian crossing when rendering
 * When west > east, we're crossing the antimeridian (180°/-180° line),
 * so translate east into the +360 range for proper MapLibre rendering.
 *
 * @param west - West longitude
 * @param east - East longitude
 * @returns Adjusted east longitude for rendering
 */
export function adjustEastForAntimeridian(west: number, east: number): number {
  return west > east ? east + DEGREES_IN_CIRCLE : east;
}

/**
 * Prepares bounding box coordinates for rendering, handling antimeridian crossing
 * @param west - West longitude
 * @param south - South latitude
 * @param east - East longitude
 * @param north - North latitude
 * @returns Object with renderWest, renderEast, south, north
 */
export function prepareBoundsForRendering(
  west: number,
  south: number,
  east: number,
  north: number
) {
  return {
    renderWest: west,
    renderEast: adjustEastForAntimeridian(west, east),
    south,
    north
  };
}

/**
 * Validates spatial bounds according to WKT conventions
 * @param boxString - Bounding box string in SOSO format: "minLat minLon maxLat maxLon"
 * @returns Error message if invalid, null if valid
 */
export function validateSpatialBounds(boxString: string): string | null {
  const trimmed = boxString.trim();
  if (!trimmed) return null; // empty is valid (null)

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 4) {
    return "Must contain exactly 4 numbers: minLat minLon maxLat maxLon";
  }

  const [south, west, north, east] = parts.map(Number);

  // Check if all parts are valid numbers
  if (
    parts.some((part, i) => !Number.isFinite([south, west, north, east][i]))
  ) {
    return "All values must be valid numbers";
  }

  // WKT longitude bounds: -180 to 180
  if (
    west < MIN_LONGITUDE ||
    west > MAX_LONGITUDE ||
    east < MIN_LONGITUDE ||
    east > MAX_LONGITUDE
  ) {
    return "Longitude (W, E) must be between -180 and 180";
  }

  // WKT latitude bounds: -90 to 90
  if (
    south < MIN_LATITUDE ||
    south > MAX_LATITUDE ||
    north < MIN_LATITUDE ||
    north > MAX_LATITUDE
  ) {
    return "Latitude (S, N) must be between -90 and 90";
  }

  // Note: W and E are positional (left/right edges), so west > east is valid for antimeridian crossing

  if (north <= south) {
    return "North latitude must be greater than South latitude";
  }

  return null; // valid
}

/**
 * Resolves two clicked points into a bounding box, handling antimeridian crossing.
 * Click order does not matter — the result is always { west, south, east, north }
 * where west is the westernmost edge. For antimeridian-crossing boxes, west > east.
 */
export function resolveBoxFromClicks(
  click1: { lng: number; lat: number },
  click2: { lng: number; lat: number }
): { west: number; south: number; east: number; north: number } {
  const lng1 = normalizeLongitude(click1.lng);
  const lng2 = normalizeLongitude(click2.lng);

  const directDistance = Math.abs(lng2 - lng1);
  const wrapDistance = DEGREES_IN_CIRCLE - directDistance;
  const crossesAntimeridian = wrapDistance < directDistance;

  let west, east;
  if (crossesAntimeridian) {
    west = Math.max(lng1, lng2);
    east = Math.min(lng1, lng2);
  } else {
    west = Math.min(lng1, lng2);
    east = Math.max(lng1, lng2);
  }

  const south = Math.min(click1.lat, click2.lat);
  const north = Math.max(click1.lat, click2.lat);

  return { west, south, east, north };
}

/**
 * Validates latitude coordinate range
 * @param lat - Latitude value
 * @returns true if valid, false otherwise
 */
export function isValidLatitude(lat: number): boolean {
  return lat >= MIN_LATITUDE && lat <= MAX_LATITUDE;
}

/**
 * Validates longitude coordinate range
 * @param lng - Longitude value
 * @returns true if valid, false otherwise
 */
export function isValidLongitude(lng: number): boolean {
  return lng >= MIN_LONGITUDE && lng <= MAX_LONGITUDE;
}
