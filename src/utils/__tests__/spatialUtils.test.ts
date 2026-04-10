import { describe, it, expect } from "vitest";
import {
  normalizeLongitude,
  adjustEastForAntimeridian,
  prepareBoundsForRendering,
  validateSpatialBounds,
  resolveBoxFromClicks,
  isValidLatitude,
  isValidLongitude
} from "../spatialUtils";
import {
  parseBoundsString,
  formatBoundsString
} from "../mapLayerUtils";

// ── normalizeLongitude ──────────────────────────────────────────────

describe("normalizeLongitude", () => {
  it("passes through values already in [-180, 180]", () => {
    expect(normalizeLongitude(0)).toBe(0);
    expect(normalizeLongitude(180)).toBe(180);
    expect(normalizeLongitude(-180)).toBe(-180);
    expect(normalizeLongitude(45.5)).toBe(45.5);
  });

  it("wraps values > 180 back into range", () => {
    expect(normalizeLongitude(181)).toBe(-179);
    expect(normalizeLongitude(360)).toBe(0);
    expect(normalizeLongitude(540)).toBe(180);
  });

  it("wraps values < -180 back into range", () => {
    expect(normalizeLongitude(-181)).toBe(179);
    expect(normalizeLongitude(-360)).toBe(-0); // JS: -360 % 360 === -0
  });
});

// ── adjustEastForAntimeridian ───────────────────────────────────────

describe("adjustEastForAntimeridian", () => {
  it("returns east unchanged when west < east (no crossing)", () => {
    expect(adjustEastForAntimeridian(-10, 10)).toBe(10);
    expect(adjustEastForAntimeridian(-125, -120)).toBe(-120);
  });

  it("adds 360 to east when west > east (crossing)", () => {
    // Box from 170E to 170W (east = -170)
    expect(adjustEastForAntimeridian(170, -170)).toBe(190);
    // Box from 160E to 160W
    expect(adjustEastForAntimeridian(160, -160)).toBe(200);
  });

  it("returns east unchanged when west === east", () => {
    expect(adjustEastForAntimeridian(10, 10)).toBe(10);
  });
});

// ── prepareBoundsForRendering ───────────────────────────────────────

describe("prepareBoundsForRendering", () => {
  it("passes through normal bounds", () => {
    const result = prepareBoundsForRendering(-125, 32, -114, 42);
    expect(result).toEqual({
      renderWest: -125,
      renderEast: -114,
      south: 32,
      north: 42
    });
  });

  it("adjusts east for antimeridian crossing", () => {
    const result = prepareBoundsForRendering(170, -10, -170, 10);
    expect(result).toEqual({
      renderWest: 170,
      renderEast: 190,
      south: -10,
      north: 10
    });
  });
});

// ── validateSpatialBounds ───────────────────────────────────────────

describe("validateSpatialBounds", () => {
  it("accepts valid normal bounds", () => {
    expect(validateSpatialBounds("32 -125 42 -114")).toBeNull();
  });

  it("accepts empty string (null spatial coverage)", () => {
    expect(validateSpatialBounds("")).toBeNull();
    expect(validateSpatialBounds("   ")).toBeNull();
  });

  it("accepts antimeridian-crossing bounds (west > east)", () => {
    // Box from 170E to 170W: minLat=10 minLon=170 maxLat=20 maxLon=-170
    expect(validateSpatialBounds("10 170 20 -170")).toBeNull();
  });

  it("rejects when north <= south", () => {
    expect(validateSpatialBounds("42 -125 32 -114")).not.toBeNull();
    expect(validateSpatialBounds("10 0 10 1")).not.toBeNull();
  });

  it("rejects out-of-range latitude", () => {
    expect(validateSpatialBounds("91 0 92 1")).not.toBeNull();
    expect(validateSpatialBounds("-91 0 0 1")).not.toBeNull();
  });

  it("rejects out-of-range longitude", () => {
    expect(validateSpatialBounds("0 181 1 2")).not.toBeNull();
    expect(validateSpatialBounds("0 0 1 -181")).not.toBeNull();
  });

  it("rejects wrong number of parts", () => {
    expect(validateSpatialBounds("1 2 3")).not.toBeNull();
    expect(validateSpatialBounds("1 2 3 4 5")).not.toBeNull();
  });

  it("rejects non-numeric values", () => {
    expect(validateSpatialBounds("a b c d")).not.toBeNull();
  });
});

// ── parseBoundsString / formatBoundsString ──────────────────────────

describe("parseBoundsString", () => {
  it("parses SOSO format (S W N E) into named coordinates", () => {
    const result = parseBoundsString("32 -125 42 -114");
    expect(result).toEqual({ south: 32, west: -125, north: 42, east: -114 });
  });

  it("parses antimeridian-crossing bounds", () => {
    const result = parseBoundsString("10 170 20 -170");
    expect(result).toEqual({ south: 10, west: 170, north: 20, east: -170 });
  });

  it("returns null for empty/invalid input", () => {
    expect(parseBoundsString("")).toBeNull();
    expect(parseBoundsString("  ")).toBeNull();
    expect(parseBoundsString("1 2 3")).toBeNull();
    expect(parseBoundsString("a b c d")).toBeNull();
  });

  it("handles extra whitespace", () => {
    const result = parseBoundsString("  32  -125   42  -114  ");
    expect(result).toEqual({ south: 32, west: -125, north: 42, east: -114 });
  });
});

describe("formatBoundsString", () => {
  it("formats as SOSO (S W N E)", () => {
    const result = formatBoundsString(-125, 32, -114, 42);
    // Args: west, south, east, north → output: "south west north east"
    expect(result).toBe("32.000000 -125.000000 42.000000 -114.000000");
  });

  it("formats antimeridian-crossing bounds", () => {
    const result = formatBoundsString(170, 10, -170, 20);
    expect(result).toBe("10.000000 170.000000 20.000000 -170.000000");
  });

  it("respects custom precision", () => {
    const result = formatBoundsString(-125, 32, -114, 42, 2);
    expect(result).toBe("32.00 -125.00 42.00 -114.00");
  });
});

describe("parseBoundsString / formatBoundsString round-trip", () => {
  it("round-trips normal bounds", () => {
    const original = { west: -125, south: 32, east: -114, north: 42 };
    const str = formatBoundsString(original.west, original.south, original.east, original.north);
    const parsed = parseBoundsString(str);
    expect(parsed).toEqual(original);
  });

  it("round-trips antimeridian-crossing bounds", () => {
    const original = { west: 170, south: -10, east: -170, north: 10 };
    const str = formatBoundsString(original.west, original.south, original.east, original.north);
    const parsed = parseBoundsString(str);
    expect(parsed).toEqual(original);
  });

  it("round-trips the SOSO spec example", () => {
    // SOSO example: "39.3280 120.1633 40.4450 123.7878"
    const parsed = parseBoundsString("39.3280 120.1633 40.4450 123.7878");
    expect(parsed).toEqual({ south: 39.328, west: 120.1633, north: 40.445, east: 123.7878 });
    const formatted = formatBoundsString(parsed!.west, parsed!.south, parsed!.east, parsed!.north, 4);
    expect(formatted).toBe("39.3280 120.1633 40.4450 123.7878");
  });
});

// ── resolveBoxFromClicks ────────────────────────────────────────────

describe("resolveBoxFromClicks", () => {
  describe("normal boxes (no antimeridian crossing)", () => {
    it("resolves a simple box", () => {
      const result = resolveBoxFromClicks(
        { lng: -125, lat: 32 },
        { lng: -114, lat: 42 }
      );
      expect(result).toEqual({ west: -125, south: 32, east: -114, north: 42 });
    });

    it("produces the same box regardless of click order", () => {
      const a = { lng: -125, lat: 32 };
      const b = { lng: -114, lat: 42 };

      const forward = resolveBoxFromClicks(a, b);
      const reversed = resolveBoxFromClicks(b, a);
      expect(forward).toEqual(reversed);
    });

    it("produces the same box when corners are swapped diagonally", () => {
      // NW then SE
      const nwSe = resolveBoxFromClicks(
        { lng: -125, lat: 42 },
        { lng: -114, lat: 32 }
      );
      // SE then NW
      const seNw = resolveBoxFromClicks(
        { lng: -114, lat: 32 },
        { lng: -125, lat: 42 }
      );
      // SW then NE
      const swNe = resolveBoxFromClicks(
        { lng: -125, lat: 32 },
        { lng: -114, lat: 42 }
      );
      // NE then SW
      const neSw = resolveBoxFromClicks(
        { lng: -114, lat: 42 },
        { lng: -125, lat: 32 }
      );

      expect(nwSe).toEqual(seNw);
      expect(swNe).toEqual(neSw);
      expect(nwSe).toEqual(swNe);
    });
  });

  describe("antimeridian-crossing boxes", () => {
    it("detects crossing when shortest path goes over the antimeridian", () => {
      // Fiji area: 170E to 170W — shortest path crosses antimeridian (40° span)
      const result = resolveBoxFromClicks(
        { lng: 170, lat: -20 },
        { lng: -170, lat: -10 }
      );
      expect(result.west).toBe(170);
      expect(result.east).toBe(-170);
      expect(result.south).toBe(-20);
      expect(result.north).toBe(-10);
    });

    it("produces the same antimeridian box regardless of click order", () => {
      const a = { lng: 170, lat: -20 };
      const b = { lng: -170, lat: -10 };

      const forward = resolveBoxFromClicks(a, b);
      const reversed = resolveBoxFromClicks(b, a);
      expect(forward).toEqual(reversed);
    });

    it("handles narrow antimeridian crossing", () => {
      // 179E to 179W — very narrow 2° box across antimeridian
      const result = resolveBoxFromClicks(
        { lng: 179, lat: 0 },
        { lng: -179, lat: 5 }
      );
      expect(result.west).toBe(179);
      expect(result.east).toBe(-179);
    });

    it("does NOT cross when the direct path is shorter", () => {
      // 10E to 20E — direct path is 10°, wrap path is 350°
      const result = resolveBoxFromClicks(
        { lng: 10, lat: 0 },
        { lng: 20, lat: 5 }
      );
      expect(result.west).toBe(10);
      expect(result.east).toBe(20);
    });

    it("normalizes out-of-range longitudes before resolving", () => {
      // MapLibre can report lng > 180 when panning
      const result = resolveBoxFromClicks(
        { lng: 190, lat: 0 },   // normalizes to -170
        { lng: 170, lat: 10 }
      );
      // 170 to -170 crosses antimeridian
      expect(result.west).toBe(170);
      expect(result.east).toBe(-170);
    });
  });

  describe("edge cases", () => {
    it("handles both points at the same longitude", () => {
      const result = resolveBoxFromClicks(
        { lng: 10, lat: 0 },
        { lng: 10, lat: 5 }
      );
      expect(result.west).toBe(10);
      expect(result.east).toBe(10);
    });

    it("handles both points at the same latitude", () => {
      const result = resolveBoxFromClicks(
        { lng: 10, lat: 5 },
        { lng: 20, lat: 5 }
      );
      expect(result.south).toBe(5);
      expect(result.north).toBe(5);
    });

    it("handles exactly 180° apart (ambiguous — either path is equal)", () => {
      // When direct = wrap = 180°, crossesAntimeridian is false (not strictly less)
      const result = resolveBoxFromClicks(
        { lng: 0, lat: 0 },
        { lng: 180, lat: 10 }
      );
      expect(result.west).toBe(0);
      expect(result.east).toBe(180);
    });
  });
});

// ── antimeridian rendering pipeline ─────────────────────────────────

describe("antimeridian rendering pipeline", () => {
  it("full pipeline: click → resolve → format → parse → adjust for rendering", () => {
    // Simulate two clicks near Fiji
    const box = resolveBoxFromClicks(
      { lng: 175, lat: -18 },
      { lng: -175, lat: -15 }
    );
    expect(box.west).toBeGreaterThan(box.east); // confirms antimeridian crossing

    // Format to SOSO string
    const str = formatBoundsString(box.west, box.south, box.east, box.north);
    expect(str).toContain("175"); // west
    expect(str).toContain("-175"); // east

    // Parse back
    const parsed = parseBoundsString(str)!;
    expect(parsed.west).toBeGreaterThan(parsed.east);

    // Validate accepts it
    expect(validateSpatialBounds(str)).toBeNull();

    // Prepare for rendering — east should be adjusted to > 180
    const render = prepareBoundsForRendering(parsed.west, parsed.south, parsed.east, parsed.north);
    expect(render.renderEast).toBeGreaterThan(180);
    expect(render.renderEast).toBe(parsed.east + 360);
  });
});

// ── isValidLatitude / isValidLongitude ──────────────────────────────

describe("isValidLatitude", () => {
  it("accepts values in [-90, 90]", () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
  });

  it("rejects values outside [-90, 90]", () => {
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(-91)).toBe(false);
  });
});

describe("isValidLongitude", () => {
  it("accepts values in [-180, 180]", () => {
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
  });

  it("rejects values outside [-180, 180]", () => {
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
  });
});
