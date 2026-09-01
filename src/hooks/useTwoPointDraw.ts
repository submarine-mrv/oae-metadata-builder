/**
 * useTwoPointDraw - Draw a shape on a MapLibre map from two points.
 *
 * Shared by the three draw flows that were previously copy-pasted:
 * SpatialCoverageMapModal (bounding box), DosingLocationMapModal box mode, and
 * DosingLocationMapModal line mode.
 *
 * Three gestures reach the same result:
 *   - click, move, click
 *   - press, drag, release
 *   - tap, drag, lift (touch)
 *
 * `onPreview` fires continuously while the pointer moves, so the user sees the
 * shape they are forming before committing it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface DrawPoint {
  lng: number;
  lat: number;
}

interface UseTwoPointDrawOptions {
  /** MapLibre map instance, or null before it loads. */
  map: any;
  /** Called on every pointer move once a start point exists. */
  onPreview: (start: DrawPoint, current: DrawPoint) => void;
  /** Called once the second point is committed. */
  onComplete: (start: DrawPoint, end: DrawPoint) => void;
  /** Called when drawing begins, e.g. to clear a previous shape. */
  onStart?: () => void;
  /**
   * Called when a gesture is given up without completing (a pinch, a cancelled
   * touch). The half-drawn preview is still on the map at this point and the
   * caller has to clear it, or the modal shows a shape it never stored.
   */
  onAbandon?: () => void;
}

interface UseTwoPointDrawResult {
  /** True between `start()` and completion or cancellation. */
  isDrawing: boolean;
  /** True once the first point is placed and a shape is being sized. */
  hasStartPoint: boolean;
  start: () => void;
  cancel: () => void;
}

/**
 * A press that moves less than this many pixels before release counts as a
 * click, not a drag — otherwise the jitter in a normal click would commit a
 * degenerate zero-area shape.
 */
const DRAG_THRESHOLD_PX = 4;

export function useTwoPointDraw({
  map,
  onPreview,
  onComplete,
  onStart,
  onAbandon,
}: UseTwoPointDrawOptions): UseTwoPointDrawResult {
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStartPoint, setHasStartPoint] = useState(false);

  // Refs, not state: listeners are registered once per draw session and would
  // otherwise close over stale values.
  const startPointRef = useRef<DrawPoint | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  // MapLibre emits `click` after `mousedown`/`mouseup` at the same spot, so the
  // opening press generates a click that must not also close the shape.
  const openingClickPendingRef = useRef(false);
  // Latched once a gesture turns into a pinch, so the touchend that ends it
  // cannot be mistaken for the release of a drag.
  const multiTouchRef = useRef(false);
  const teardownRef = useRef<(() => void) | null>(null);

  // Latest callbacks, so a re-render with new closures doesn't require
  // re-registering listeners mid-gesture.
  const handlersRef = useRef({ onPreview, onComplete, onStart, onAbandon });
  handlersRef.current = { onPreview, onComplete, onStart, onAbandon };

  const cancel = useCallback(() => {
    teardownRef.current?.();
  }, []);

  const start = useCallback(() => {
    if (!map) return;

    // Restart cleanly if a previous session is still attached.
    teardownRef.current?.();

    handlersRef.current.onStart?.();
    setIsDrawing(true);
    setHasStartPoint(false);
    startPointRef.current = null;
    pressOriginRef.current = null;
    openingClickPendingRef.current = false;
    multiTouchRef.current = false;
    map.getCanvas().style.cursor = "crosshair";

    const teardown = () => {
      // The modal can dispose the map before this runs; detaching from a removed
      // MapLibre instance throws.
      try {
        map.off("mousedown", onMouseDown);
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
        map.off("touchstart", onTouchStart);
        map.off("touchmove", onTouchMove);
        map.off("touchend", onTouchEnd);
        map.off("touchcancel", onTouchCancel);
        map.off("click", onClick);
        map.dragPan.enable();
        map.getCanvas().style.cursor = "";
      } catch {
        // Map already removed — nothing left to detach.
      }
      startPointRef.current = null;
      pressOriginRef.current = null;
      openingClickPendingRef.current = false;
      multiTouchRef.current = false;
      teardownRef.current = null;
      setIsDrawing(false);
      setHasStartPoint(false);
    };

    const finish = (from: DrawPoint, to: DrawPoint) => {
      handlersRef.current.onComplete(from, to);
      teardown();
    };

    const onMouseDown = (e: any) => {
      // Only the primary button draws; right-click keeps its context menu.
      if (e.originalEvent?.button !== 0) return;
      if (startPointRef.current) return;

      pressOriginRef.current = { x: e.point.x, y: e.point.y };
      openingClickPendingRef.current = true;
      // Suppress panning for the duration of a potential drag.
      map.dragPan.disable();

      const point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      startPointRef.current = point;
      setHasStartPoint(true);
      handlersRef.current.onPreview(point, point);
    };

    const onMouseMove = (e: any) => {
      const from = startPointRef.current;
      if (!from) return;
      handlersRef.current.onPreview(from, { lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    const onMouseUp = (e: any) => {
      const from = startPointRef.current;
      const origin = pressOriginRef.current;
      map.dragPan.enable();
      if (!from || !origin) return;

      pressOriginRef.current = null;
      const movedPx = Math.hypot(e.point.x - origin.x, e.point.y - origin.y);
      if (movedPx < DRAG_THRESHOLD_PX) {
        // A click, not a drag. Stay armed for the closing click.
        return;
      }
      // A real drag. `finish` tears down the listeners, so the click this
      // release emits never reaches us.
      finish(from, { lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    // MapLibre emits touch events separately from mouse ones. Without these a
    // touch drag pans the map instead of drawing, and only tap-tap works.
    const touchCount = (e: any) => e.points?.length ?? 1;

    /**
     * Abandon the shape in progress without completing it. A second finger means
     * the user is pinching, and lifting either finger would otherwise commit a
     * shape at whichever coordinate that finger happened to be over.
     */
    const abandonTouchGesture = () => {
      multiTouchRef.current = true;
      pressOriginRef.current = null;
      startPointRef.current = null;
      openingClickPendingRef.current = false;
      map.dragPan.enable();
      setHasStartPoint(false);
      handlersRef.current.onAbandon?.();
    };

    const onTouchStart = (e: any) => {
      if (touchCount(e) > 1) {
        // Pinch beginning, possibly part-way through a drag.
        if (startPointRef.current) abandonTouchGesture();
        return;
      }
      // A fresh single-finger touch clears the multi-touch latch.
      multiTouchRef.current = false;
      if (startPointRef.current) return;

      pressOriginRef.current = { x: e.point.x, y: e.point.y };
      openingClickPendingRef.current = true;
      map.dragPan.disable();

      const point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      startPointRef.current = point;
      setHasStartPoint(true);
      handlersRef.current.onPreview(point, point);
    };

    const onTouchMove = (e: any) => {
      if (touchCount(e) > 1) {
        if (startPointRef.current) abandonTouchGesture();
        return;
      }
      const from = startPointRef.current;
      if (!from || multiTouchRef.current) return;
      handlersRef.current.onPreview(from, { lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    const onTouchEnd = (e: any) => {
      const from = startPointRef.current;
      const origin = pressOriginRef.current;
      map.dragPan.enable();
      // Lifting a finger out of a pinch must not commit anything.
      if (!from || !origin || multiTouchRef.current) return;

      pressOriginRef.current = null;
      // A touchend carries no coordinates of its own; the last touchmove holds
      // where the finger ended up.
      const point = e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null;
      const endPoint = e.point ?? origin;
      const movedPx = Math.hypot(endPoint.x - origin.x, endPoint.y - origin.y);
      if (movedPx < DRAG_THRESHOLD_PX || !point) {
        // A tap, not a drag. Stay armed for the closing tap.
        return;
      }
      finish(from, point);
    };

    const onTouchCancel = () => {
      if (startPointRef.current) abandonTouchGesture();
    };

    const onClick = (e: any) => {
      // The press that opened the shape emits its own click; swallow it.
      if (openingClickPendingRef.current) {
        openingClickPendingRef.current = false;
        return;
      }
      const point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      const from = startPointRef.current;
      if (!from) {
        // No mousedown ran — a tap. Open the shape here instead.
        startPointRef.current = point;
        setHasStartPoint(true);
        handlersRef.current.onPreview(point, point);
        return;
      }
      finish(from, point);
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    map.on("touchstart", onTouchStart);
    map.on("touchmove", onTouchMove);
    map.on("touchend", onTouchEnd);
    map.on("touchcancel", onTouchCancel);
    map.on("click", onClick);
    teardownRef.current = teardown;
  }, [map]);

  // Detach when the map instance is replaced (modal close) and on unmount.
  useEffect(() => {
    return () => {
      teardownRef.current?.();
    };
  }, [map]);

  return { isDrawing, hasStartPoint, start, cancel };
}
