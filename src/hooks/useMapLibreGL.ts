import { useEffect, useState, useRef } from "react";
import { MAP_TILE_STYLE, MAPLIBRE_GL_CSS_URL, MAPLIBRE_GL_JS_URL } from "@/config/maps";

declare global {
  interface Window {
    maplibregl?: any;
  }
}

interface MapLibreConfig {
  styleUrl?: string;
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
}

interface UseMapLibreGLReturn {
  mapInstance: any | null;
  isLoaded: boolean;
  error: Error | null;
}

export function useMapLibreGL(
  containerRef: React.RefObject<HTMLDivElement>,
  config: MapLibreConfig = {},
  shouldLoad: boolean = true
): UseMapLibreGLReturn {
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!shouldLoad) return;

    const loadAndInitialize = async () => {
      try {
        // Load MapLibre GL library if not already loaded
        if (!window.maplibregl) {
          // Load CSS
          if (!document.querySelector('link[href*="maplibre-gl.css"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = MAPLIBRE_GL_CSS_URL;
            document.head.appendChild(link);
          }

          // Load JS
          const script = document.createElement("script");
          script.src = MAPLIBRE_GL_JS_URL;
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load MapLibre GL"));
            document.head.appendChild(script);
          });
        }

        // Initialize map
        requestAnimationFrame(() => {
          if (containerRef.current && !mapInstanceRef.current) {
            const map = new window.maplibregl.Map({
              container: containerRef.current,
              style: config.styleUrl || MAP_TILE_STYLE,
              center: config.center || [0, 0],
              zoom: config.zoom ?? 2,
              interactive: config.interactive ?? true,
              attributionControl: false
            });

            map.on("load", () => {
              mapInstanceRef.current = map;
              setMapInstance(map);
              setIsLoaded(true);
            });

            map.on("error", (e: any) => {
              setError(e.error || new Error("Map error"));
            });
          }
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error("MapLibre loading failed:", error);
      }
    };

    loadAndInitialize();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [shouldLoad, containerRef, config.styleUrl, config.center, config.zoom, config.interactive]);

  return { mapInstance, isLoaded, error };
}
