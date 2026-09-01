import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTwoPointDraw } from "../useTwoPointDraw";

/**
 * MapLibre stand-in that lets a test emit events the way the real map does.
 * A real click emits mousedown, then mouseup, then click.
 */
function createFakeMap() {
  const handlers = new Map<string, Set<(e: any) => void>>();
  const canvas = { style: { cursor: "" } };

  const emit = (type: string, e: any) => {
    for (const fn of [...(handlers.get(type) ?? [])]) fn(e);
  };

  return {
    dragPan: { enable: vi.fn(), disable: vi.fn() },
    getCanvas: () => canvas,
    canvas,
    on: vi.fn((type: string, fn: (e: any) => void) => {
      if (!handlers.get(type)) handlers.set(type, new Set());
      handlers.get(type)?.add(fn);
    }),
    off: vi.fn((type: string, fn: (e: any) => void) => {
      handlers.get(type)?.delete(fn);
    }),
    handlers,
    emit,
    /** Emit the full mousedown/mouseup/click sequence a real click produces. */
    click(lng: number, lat: number, x = 0, y = 0) {
      const e = { lngLat: { lng, lat }, point: { x, y }, originalEvent: { button: 0 } };
      emit("mousedown", e);
      emit("mouseup", e);
      emit("click", e);
    },
    move(lng: number, lat: number, x = 0, y = 0) {
      emit("mousemove", { lngLat: { lng, lat }, point: { x, y } });
    },
  };
}

function setup(map: any) {
  const onPreview = vi.fn();
  const onComplete = vi.fn();
  const onStart = vi.fn();
  const hook = renderHook(() => useTwoPointDraw({ map, onPreview, onComplete, onStart }));
  return { hook, onPreview, onComplete, onStart };
}

describe("useTwoPointDraw", () => {
  let map: ReturnType<typeof createFakeMap>;

  beforeEach(() => {
    map = createFakeMap();
  });

  it("does nothing until start() is called", () => {
    const { onPreview, onComplete } = setup(map);
    act(() => {
      map.click(10, 20);
    });
    expect(onPreview).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("clears the previous shape when drawing begins", () => {
    const { hook, onStart } = setup(map);
    act(() => hook.result.current.start());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(map.canvas.style.cursor).toBe("crosshair");
    expect(hook.result.current.isDrawing).toBe(true);
  });

  describe("click, move, click", () => {
    it("does not complete on the opening click", () => {
      const { hook, onComplete } = setup(map);
      act(() => hook.result.current.start());
      act(() => {
        map.click(10, 20);
      });

      expect(onComplete).not.toHaveBeenCalled();
      expect(hook.result.current.hasStartPoint).toBe(true);
    });

    it("previews continuously between the two clicks", () => {
      const { hook, onPreview } = setup(map);
      act(() => hook.result.current.start());
      act(() => {
        map.click(10, 20);
      });
      onPreview.mockClear();

      act(() => {
        map.move(12, 22);
        map.move(14, 24);
      });

      expect(onPreview).toHaveBeenCalledTimes(2);
      expect(onPreview).toHaveBeenLastCalledWith({ lng: 10, lat: 20 }, { lng: 14, lat: 24 });
    });

    it("completes on the closing click and tears down", () => {
      const { hook, onComplete } = setup(map);
      act(() => hook.result.current.start());
      act(() => {
        map.click(10, 20);
      });
      act(() => {
        map.click(30, 40);
      });

      expect(onComplete).toHaveBeenCalledExactlyOnceWith(
        { lng: 10, lat: 20 },
        { lng: 30, lat: 40 },
      );
      expect(hook.result.current.isDrawing).toBe(false);
      expect(map.canvas.style.cursor).toBe("");
    });
  });

  describe("press, drag, release", () => {
    it("completes on release and suppresses panning during the drag", () => {
      const { hook, onComplete } = setup(map);
      act(() => hook.result.current.start());

      act(() => {
        map.emit("mousedown", {
          lngLat: { lng: 10, lat: 20 },
          point: { x: 100, y: 100 },
          originalEvent: { button: 0 },
        });
      });
      expect(map.dragPan.disable).toHaveBeenCalled();

      act(() => {
        map.move(20, 30, 160, 150);
        map.emit("mouseup", { lngLat: { lng: 20, lat: 30 }, point: { x: 160, y: 150 } });
      });

      expect(onComplete).toHaveBeenCalledExactlyOnceWith(
        { lng: 10, lat: 20 },
        { lng: 20, lat: 30 },
      );
      expect(map.dragPan.enable).toHaveBeenCalled();
      expect(hook.result.current.isDrawing).toBe(false);
    });

    it("treats a sub-threshold drag as a click rather than a zero-area shape", () => {
      const { hook, onComplete } = setup(map);
      act(() => hook.result.current.start());

      act(() => {
        map.emit("mousedown", {
          lngLat: { lng: 10, lat: 20 },
          point: { x: 100, y: 100 },
          originalEvent: { button: 0 },
        });
        map.emit("mouseup", { lngLat: { lng: 10, lat: 20 }, point: { x: 101, y: 101 } });
        map.emit("click", { lngLat: { lng: 10, lat: 20 }, point: { x: 101, y: 101 } });
      });

      expect(onComplete).not.toHaveBeenCalled();
      expect(hook.result.current.hasStartPoint).toBe(true);
    });

    it("ignores non-primary buttons so right-click keeps its context menu", () => {
      const { hook, onPreview } = setup(map);
      act(() => hook.result.current.start());

      act(() => {
        map.emit("mousedown", {
          lngLat: { lng: 10, lat: 20 },
          point: { x: 100, y: 100 },
          originalEvent: { button: 2 },
        });
      });

      expect(onPreview).not.toHaveBeenCalled();
      expect(hook.result.current.hasStartPoint).toBe(false);
    });
  });

  it("detaches every listener after completing", () => {
    const { hook } = setup(map);
    act(() => hook.result.current.start());
    act(() => {
      map.click(10, 20);
    });
    act(() => {
      map.click(30, 40);
    });

    for (const type of ["mousedown", "mousemove", "mouseup", "click"]) {
      expect(map.handlers.get(type)?.size ?? 0).toBe(0);
    }
  });

  it("cancel() stops an in-progress draw without completing", () => {
    const { hook, onComplete } = setup(map);
    act(() => hook.result.current.start());
    act(() => {
      map.click(10, 20);
    });
    act(() => hook.result.current.cancel());

    expect(onComplete).not.toHaveBeenCalled();
    expect(hook.result.current.isDrawing).toBe(false);
    expect(map.canvas.style.cursor).toBe("");
  });

  it("restarting abandons a half-drawn shape", () => {
    const { hook, onComplete, onStart } = setup(map);
    act(() => hook.result.current.start());
    act(() => {
      map.click(10, 20);
    });
    act(() => hook.result.current.start());

    expect(onStart).toHaveBeenCalledTimes(2);
    expect(hook.result.current.hasStartPoint).toBe(false);

    act(() => {
      map.click(50, 60);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
