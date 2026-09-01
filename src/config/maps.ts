/**
 * Map configuration constants
 */

export const MAP_TILE_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const MAPLIBRE_GL_VERSION = "4.5.2";
export const MAPLIBRE_GL_CSS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css`;
export const MAPLIBRE_GL_JS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js`;

// Default map center (Pacific Northwest - Seattle area)
export const DEFAULT_MAP_CENTER: [number, number] = [0, 20];
export const DEFAULT_ZOOM = 1;
export const DEFAULT_MINI_MAP_ZOOM = 2;
