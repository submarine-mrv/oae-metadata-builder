import { beforeEach, describe, expect, it } from "vitest";
import { exposeMapForTests } from "../mapTestHooks";

function fakeMap() {
  const handlers = new Map<string, Array<() => void>>();
  return {
    on(type: string, fn: () => void) {
      const list = handlers.get(type) ?? [];
      list.push(fn);
      handlers.set(type, list);
    },
    fire(type: string) {
      for (const fn of handlers.get(type) ?? []) fn();
    },
  };
}

describe("exposeMapForTests", () => {
  beforeEach(() => {
    window.__oaeMaps = undefined;
  });

  it("marks the container as not loaded until the map fires load", () => {
    const container = document.createElement("div");
    const map = fakeMap();

    exposeMapForTests("test-map", container, map);
    expect(container.dataset.mapName).toBe("test-map");
    expect(container.dataset.mapLoaded).toBe("false");

    map.fire("load");
    expect(container.dataset.mapLoaded).toBe("true");
  });

  it("resets the flag and drops the registry entry when the map is removed", () => {
    const container = document.createElement("div");
    const map = fakeMap();

    exposeMapForTests("test-map", container, map);
    map.fire("load");
    expect(window.__oaeMaps?.get("test-map")).toBe(map);

    map.fire("remove");
    expect(container.dataset.mapLoaded).toBe("false");
    expect(window.__oaeMaps?.has("test-map")).toBe(false);
  });

  it("keeps one registry entry per map name", () => {
    const a = fakeMap();
    const b = fakeMap();

    exposeMapForTests("a", document.createElement("div"), a);
    exposeMapForTests("b", document.createElement("div"), b);

    expect(window.__oaeMaps?.size).toBe(2);
    expect(window.__oaeMaps?.get("b")).toBe(b);
  });

  it("does nothing without a container", () => {
    const map = fakeMap();
    exposeMapForTests("orphan", null, map);
    expect(window.__oaeMaps).toBeUndefined();
  });
});
