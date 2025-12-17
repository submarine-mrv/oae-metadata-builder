/**
 * useMapLibreLoader - Hook to load MapLibre GL library dynamically
 *
 * Currently used by:
 * - SpatialCoverageField
 * - SpatialCoverageMapModal
 *
 * TODO: Integrate with DosingLocationField and DosingLocationMapModal
 * (these currently have their own inline MapLibre loading logic)
 *
 * @returns Object with `isLoaded` boolean and `error` if loading failed
 */

import { useState, useEffect, useCallback } from "react";
import { MAPLIBRE_GL_CSS_URL, MAPLIBRE_GL_JS_URL } from "@/config/maps";

// Extend Window interface for MapLibre
declare global {
  interface Window {
    maplibregl?: any;
  }
}

interface UseMapLibreLoaderResult {
  isLoaded: boolean;
  error: Error | null;
  loadMapLibre: () => Promise<void>;
}

// Track loading state globally to prevent duplicate loads
let loadingPromise: Promise<void> | null = null;
let isGloballyLoaded = false;

/**
 * Load MapLibre CSS by appending a link element to the document head
 */
function loadCSS(): void {
  if (document.querySelector(`link[href="${MAPLIBRE_GL_CSS_URL}"]`)) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = MAPLIBRE_GL_CSS_URL;
  document.head.appendChild(link);
}

/**
 * Load MapLibre JS by appending a script element to the document head
 */
function loadJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MAPLIBRE_GL_JS_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load MapLibre GL JS"));
    document.head.appendChild(script);
  });
}

/**
 * Hook to manage MapLibre GL library loading
 *
 * @param autoLoad - Whether to automatically load on mount (default: true)
 * @returns Loading state and manual load function
 *
 * @example
 * ```tsx
 * const { isLoaded, error } = useMapLibreLoader();
 *
 * useEffect(() => {
 *   if (isLoaded && mapRef.current) {
 *     initializeMap();
 *   }
 * }, [isLoaded]);
 * ```
 */
export function useMapLibreLoader(autoLoad = true): UseMapLibreLoaderResult {
  const [isLoaded, setIsLoaded] = useState(isGloballyLoaded);
  const [error, setError] = useState<Error | null>(null);

  const loadMapLibre = useCallback(async (): Promise<void> => {
    // Already loaded
    if (window.maplibregl) {
      isGloballyLoaded = true;
      setIsLoaded(true);
      return;
    }

    // Already loading, wait for existing promise
    if (loadingPromise) {
      await loadingPromise;
      setIsLoaded(true);
      return;
    }

    // Start new load
    loadingPromise = (async () => {
      try {
        loadCSS();
        await loadJS();
        isGloballyLoaded = true;
      } catch (err) {
        loadingPromise = null;
        throw err;
      }
    })();

    try {
      await loadingPromise;
      setIsLoaded(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("MapLibre load failed");
      setError(error);
      console.error("MapLibre loading failed:", error);
    }
  }, []);

  useEffect(() => {
    if (autoLoad && typeof window !== "undefined") {
      loadMapLibre();
    }
  }, [autoLoad, loadMapLibre]);

  return { isLoaded, error, loadMapLibre };
}

export default useMapLibreLoader;
