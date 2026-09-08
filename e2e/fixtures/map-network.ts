import { createRequire } from "node:module";
import type { BrowserContext } from "@playwright/test";

const require = createRequire(import.meta.url);
const MAPLIBRE_JS = require.resolve("maplibre-gl/dist/maplibre-gl.js");
const MAPLIBRE_CSS = require.resolve("maplibre-gl/dist/maplibre-gl.css");
const VENDORED_VERSION: string = require("maplibre-gl/package.json").version;

/** Must match MAPLIBRE_GL_VERSION in src/config/maps.ts. */
const APP_VERSION = "4.5.2";

/**
 * Blank basemap served in place of the openfreemap style. A background and one
 * world-sized polygon are enough for fitBounds, zoom, and repeated-world math,
 * and keep trace screenshots legible.
 */
export const E2E_MAP_STYLE = {
  version: 8,
  name: "oae-e2e-blank",
  sources: {
    world: {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-180, -85],
              [180, -85],
              [180, 85],
              [-180, 85],
              [-180, -85],
            ],
          ],
        },
      },
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#c9dced" } },
    { id: "world", type: "fill", source: "world", paint: { "fill-color": "#f3efe6" } },
  ],
};

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1)$/;

/**
 * Keep every test offline: MapLibre comes from the vendored devDependency,
 * tiles from E2E_MAP_STYLE, fonts are dropped, and any other external request
 * fails loudly instead of adding CDN latency to the run.
 */
export async function stubMapNetwork(context: BrowserContext): Promise<void> {
  if (VENDORED_VERSION !== APP_VERSION) {
    throw new Error(
      `maplibre-gl devDependency is ${VENDORED_VERSION} but the app loads ${APP_VERSION}`,
    );
  }

  // Playwright matches routes in reverse registration order, so this catch-all runs last.
  await context.route(
    (url) => !LOCAL_HOSTS.test(url.hostname),
    (route) => route.abort("blockedbyclient"),
  );
  await context.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({ json: E2E_MAP_STYLE }),
  );
  await context.route("https://unpkg.com/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("maplibre-gl.js")) {
      return route.fulfill({ path: MAPLIBRE_JS, contentType: "application/javascript" });
    }
    if (pathname.endsWith("maplibre-gl.css")) {
      return route.fulfill({ path: MAPLIBRE_CSS, contentType: "text/css" });
    }
    return route.abort("blockedbyclient");
  });
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await context.route("https://fonts.gstatic.com/**", (route) => route.abort("blockedbyclient"));
}
