import { MantineProvider } from "@mantine/core";
import type { FieldProps } from "@rjsf/utils";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SpatialCoverageField from "../SpatialCoverageField";

/**
 * The field builds a real MapLibre map through `window.maplibregl`. Stubbing the
 * global is enough to drive the camera logic — the parts under test here are
 * which view it asks for, and when.
 */
const PREVIEW_WIDTH = 1024; // exactly two worlds at zoom 0, so the fit lands on zoom 1

function stubMapLibre() {
  const handlers = new Map<string, Array<(e: unknown) => void>>();
  const map = {
    jumpTo: vi.fn(),
    easeTo: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    getSource: vi.fn(() => undefined),
    getLayer: vi.fn(() => undefined),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeSource: vi.fn(),
    removeLayer: vi.fn(),
    getContainer: () => ({ clientWidth: PREVIEW_WIDTH }),
    on: vi.fn((type: string, fn: (e: unknown) => void) => {
      if (!handlers.get(type)) handlers.set(type, []);
      handlers.get(type)?.push(fn);
      // The component does its initial framing inside the load handler.
      if (type === "load") fn({});
    }),
    off: vi.fn(),
    emit: (type: string) => {
      for (const fn of handlers.get(type) ?? []) fn({});
    },
  };

  // `new` needs a constructible function, so these cannot be arrows.
  (window as unknown as { maplibregl: unknown }).maplibregl = {
    Map: vi.fn(function FakeMap() {
      return map;
    }),
    Marker: vi.fn(function FakeMarker() {
      return { setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn(), remove: vi.fn() };
    }),
    LngLatBounds: vi.fn(function FakeLngLatBounds() {
      return {};
    }),
  };
  return map;
}

function renderField(box?: string) {
  const props = {
    schema: { type: "object" as const, properties: {} },
    uiSchema: {},
    formData: box ? { geo: { box } } : {},
    errorSchema: {},
    idSchema: { $id: "root_spatial_coverage" },
    fieldPathId: { $id: "root_spatial_coverage", path: ["spatial_coverage"] },
    name: "spatial_coverage",
    label: "Spatial Coverage",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    registry: { formContext: {}, fields: {}, widgets: {}, templates: {} },
  } as unknown as FieldProps;

  return render(
    <MantineProvider>
      <SpatialCoverageField {...props} />
    </MantineProvider>,
  );
}

describe("SpatialCoverageField preview framing", () => {
  let map: ReturnType<typeof stubMapLibre>;

  beforeEach(() => {
    map = stubMapLibre();
  });

  afterEach(() => {
    (window as unknown as { maplibregl?: unknown }).maplibregl = undefined;
    vi.clearAllMocks();
  });

  it("frames the whole world when no bounds are set", async () => {
    renderField();
    await waitFor(() => expect(map.jumpTo).toHaveBeenCalled());
    expect(map.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 1 }));
  });

  it("registers a resize listener", async () => {
    renderField();
    await waitFor(() => expect(map.on).toHaveBeenCalledWith("resize", expect.any(Function)));
  });

  it("refits the world on resize while the preview is empty", async () => {
    renderField();
    await waitFor(() => expect(map.jumpTo).toHaveBeenCalled());
    map.jumpTo.mockClear();

    map.emit("resize");

    expect(map.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 1 }));
  });

  it("leaves the camera alone on resize once bounds are set", async () => {
    renderField("32 -125 42 -114");
    await waitFor(() => expect(map.on).toHaveBeenCalledWith("resize", expect.any(Function)));
    map.jumpTo.mockClear();

    map.emit("resize");

    // Refitting here would throw away the bounds the user picked.
    expect(map.jumpTo).not.toHaveBeenCalled();
  });
});
