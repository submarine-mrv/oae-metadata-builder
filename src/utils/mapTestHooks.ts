declare global {
  interface Window {
    __oaeMaps?: Map<string, any>;
  }
}

/**
 * Mirror a MapLibre map's lifecycle onto its container so tests can wait on
 * `data-map-loaded`, and in dev register the instance so tests can read camera
 * and source state instead of sleeping.
 */
export function exposeMapForTests(name: string, container: HTMLElement | null, map: any): void {
  if (!container) return;

  container.dataset.mapName = name;
  container.dataset.mapLoaded = "false";

  map.on("load", () => {
    container.dataset.mapLoaded = "true";
  });

  // Mode switches rebuild the dosing map in the same container; a stale "true"
  // would let a test run against a disposed instance.
  map.on("remove", () => {
    container.dataset.mapLoaded = "false";
    window.__oaeMaps?.delete(name);
  });

  if (import.meta.env.DEV) {
    window.__oaeMaps ??= new Map();
    window.__oaeMaps.set(name, map);
  }
}
