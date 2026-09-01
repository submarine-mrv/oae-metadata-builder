import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBoundingBox, addLine, setBoundingBoxData, setLineData } from "../mapLayerUtils";

/**
 * Minimal MapLibre stand-in: enough surface for the source/layer bookkeeping the
 * bbox and line helpers do.
 */
function createFakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn>; data: any }>();
  const layers = new Set<string>();

  return {
    sources,
    layers,
    getSource: vi.fn((id: string) => sources.get(id)),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    addSource: vi.fn((id: string, def: any) => {
      const entry = {
        data: def.data,
        setData: vi.fn(function (this: any, next: any) {
          entry.data = next;
        }),
      };
      sources.set(id, entry);
    }),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((def: any) => layers.add(def.id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
  };
}

const coordsOf = (map: ReturnType<typeof createFakeMap>, id: string) =>
  map.sources.get(id)?.data.geometry.coordinates;

describe("setBoundingBoxData", () => {
  let map: ReturnType<typeof createFakeMap>;

  beforeEach(() => {
    map = createFakeMap();
  });

  it("creates the source and layers when none exist yet", () => {
    setBoundingBoxData(map, -125, 32, -114, 42);

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.layers.has("bbox-fill")).toBe(true);
    expect(map.layers.has("bbox-outline")).toBe(true);
  });

  it("updates in place on later calls instead of re-adding layers", () => {
    addBoundingBox(map, -125, 32, -114, 42);
    map.addSource.mockClear();
    map.addLayer.mockClear();

    setBoundingBoxData(map, -120, 30, -110, 40);

    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
    expect(map.sources.get("bbox")?.setData).toHaveBeenCalledTimes(1);
  });

  it("writes a closed ring for the new bounds", () => {
    setBoundingBoxData(map, -125, 32, -114, 42);
    const ring = coordsOf(map, "bbox")[0];

    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual([-125, 42]);
    expect(ring[0]).toEqual(ring[4]);
  });

  it("shifts the east edge past 180 for an antimeridian box", () => {
    setBoundingBoxData(map, 170, -10, -170, 10);
    const ring = coordsOf(map, "bbox")[0];

    // east -170 renders as +190 so the polygon spans the seam
    expect(ring[1][0]).toBe(190);
  });

  it("honors a custom sourceId so dosing boxes stay separate", () => {
    setBoundingBoxData(map, -125, 32, -114, 42, { sourceId: "dosing-bbox" });

    expect(map.sources.has("dosing-bbox")).toBe(true);
    expect(map.sources.has("bbox")).toBe(false);
    expect(map.layers.has("dosing-bbox-fill")).toBe(true);
  });
});

describe("setLineData", () => {
  let map: ReturnType<typeof createFakeMap>;

  beforeEach(() => {
    map = createFakeMap();
  });

  it("creates the source and layer when none exist yet", () => {
    setLineData(map, 10, 20, 30, 40);

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.layers.has("line")).toBe(true);
  });

  it("updates in place on later calls", () => {
    addLine(map, 10, 20, 30, 40);
    map.addSource.mockClear();

    setLineData(map, 11, 21, 31, 41);

    expect(map.addSource).not.toHaveBeenCalled();
    expect(coordsOf(map, "line")).toEqual([
      [21, 11],
      [41, 31],
    ]);
  });

  it("writes coordinates as [lon, lat]", () => {
    setLineData(map, 47.6, -122.3, 48.1, -123.4, { sourceId: "dosing-line" });

    expect(coordsOf(map, "dosing-line")).toEqual([
      [-122.3, 47.6],
      [-123.4, 48.1],
    ]);
  });
});
