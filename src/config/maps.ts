/**
 * Map configuration constants
 */

export const MAP_TILE_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const MAPLIBRE_GL_VERSION = "4.5.2";
export const MAPLIBRE_GL_CSS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css`;
export const MAPLIBRE_GL_JS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js`;

// Whole-globe default: no location is assumed until the user picks one.
export const DEFAULT_MAP_CENTER: [number, number] = [0, 20];
export const DEFAULT_ZOOM = 1;

// Zoomed out far enough to read as a globe rather than a close-up of one
// continent. The world may repeat at the edges of a wide preview; that is fine.
export const DEFAULT_MINI_MAP_ZOOM = 0;
