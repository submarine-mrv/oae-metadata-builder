// customValidators.test.ts - Tests for cross-field custom validators

import { describe, it, expect } from "vitest";
import {
  validateTemporalCoverageOrder,
  validateVerticalCoverage,
  projectCustomValidate,
  experimentCustomValidate,
  composeValidators
} from "../customValidators";

/**
 * Build a mock RJSF errors object. RJSF builds this from the schema,
 * exposing `addError(msg)` on every leaf and nested node.
 */
function makeErrors(): any {
  const createNode = (): any => {
    const node: any = {
      addError: (msg: string) => {
        node.__errors = node.__errors || [];
        node.__errors.push(msg);
      }
    };
    return new Proxy(node, {
      get(target, prop) {
        if (prop in target) return target[prop as keyof typeof target];
        if (typeof prop === "symbol") return undefined;
        // Auto-vivify nested nodes on access
        target[prop as string] = createNode();
        return target[prop as string];
      }
    });
  };
  return createNode();
}

function collectErrors(node: any, path: string[] = []): Array<{ path: string; message: string }> {
  const out: Array<{ path: string; message: string }> = [];
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node.__errors)) {
    for (const msg of node.__errors) {
      out.push({ path: path.join("."), message: msg });
    }
  }
  return out;
}

function collectDeepErrors(node: any): string[] {
  // Walk by explicit property access since the Proxy auto-vivifies
  const out: string[] = [];
  const root = collectErrors(node);
  out.push(...root.map((e) => e.message));
  return out;
}

describe("validateTemporalCoverageOrder", () => {
  it("passes when temporal_coverage is undefined", () => {
    const errors = makeErrors();
    const data: any = {};
    const result = validateTemporalCoverageOrder(data, errors, undefined) as any;
    expect(collectDeepErrors(result.temporal_coverage)).toEqual([]);
  });

  it("passes when end date is the open interval marker '..'", () => {
    const errors = makeErrors();
    const data = { temporal_coverage: "2024-01-01/.." };
    const result = validateTemporalCoverageOrder(data, errors, undefined) as any;
    expect(collectDeepErrors(result.temporal_coverage)).toEqual([]);
  });

  it("passes when start <= end", () => {
    const errors = makeErrors();
    const data = { temporal_coverage: "2024-01-01/2024-12-31" };
    const result = validateTemporalCoverageOrder(data, errors, undefined) as any;
    expect(collectDeepErrors(result.temporal_coverage)).toEqual([]);
  });

  it("fails when end < start", () => {
    const errors = makeErrors();
    const data = { temporal_coverage: "2024-12-31/2024-01-01" };
    const result = validateTemporalCoverageOrder(data, errors, undefined) as any;
    expect(collectDeepErrors(result.temporal_coverage)).toContain(
      "End date must be ≥ start date."
    );
  });
});

describe("validateVerticalCoverage", () => {
  it("passes when vertical_coverage is undefined", () => {
    const errors = makeErrors();
    const data: any = {};
    const result = validateVerticalCoverage(data, errors, undefined) as any;
    expect(collectDeepErrors(result.vertical_coverage)).toEqual([]);
  });

  it("fails when max_depth > 0 (above sea surface)", () => {
    const errors = makeErrors();
    const data = { vertical_coverage: { max_depth_in_m: 5 } };
    const result = validateVerticalCoverage(data, errors, undefined) as any;
    expect(collectDeepErrors(result.vertical_coverage.max_depth_in_m)).toContain(
      "Maximum depth must be 0 or negative (below sea surface)."
    );
  });

  it("fails when min_depth < max_depth (deeper than max)", () => {
    const errors = makeErrors();
    const data = {
      vertical_coverage: { min_depth_in_m: -50, max_depth_in_m: -10 }
    };
    const result = validateVerticalCoverage(data, errors, undefined) as any;
    expect(collectDeepErrors(result.vertical_coverage.min_depth_in_m)).toContain(
      "Minimum depth must be greater than or equal to maximum depth."
    );
  });

  it("passes when min_depth >= max_depth", () => {
    const errors = makeErrors();
    const data = {
      vertical_coverage: { min_depth_in_m: -5, max_depth_in_m: -10 }
    };
    const result = validateVerticalCoverage(data, errors, undefined) as any;
    expect(collectDeepErrors(result.vertical_coverage.min_depth_in_m)).toEqual(
      []
    );
  });

  it("fails when min_height > max_height", () => {
    const errors = makeErrors();
    const data = {
      vertical_coverage: { min_height_in_m: 20, max_height_in_m: 10 }
    };
    const result = validateVerticalCoverage(data, errors, undefined) as any;
    expect(collectDeepErrors(result.vertical_coverage.min_height_in_m)).toContain(
      "Minimum height must be less than or equal to maximum height."
    );
  });
});

describe("composeValidators", () => {
  it("runs all composed validators in order", () => {
    const errors = makeErrors();
    const composed = composeValidators(
      validateTemporalCoverageOrder,
      validateVerticalCoverage
    );
    const data = {
      temporal_coverage: "2024-12-31/2024-01-01",
      vertical_coverage: { max_depth_in_m: 5 }
    };
    const result = composed(data, errors, undefined) as any;
    expect(collectDeepErrors(result.temporal_coverage)).toContain(
      "End date must be ≥ start date."
    );
    expect(collectDeepErrors(result.vertical_coverage.max_depth_in_m)).toContain(
      "Maximum depth must be 0 or negative (below sea surface)."
    );
  });
});

describe("projectCustomValidate", () => {
  it("enforces both temporal and vertical coverage rules", () => {
    const errors = makeErrors();
    const data = {
      temporal_coverage: "2024-12-31/2024-01-01",
      vertical_coverage: { min_depth_in_m: -5, max_depth_in_m: -10 } // valid depth
    };
    const result = projectCustomValidate(data, errors, undefined) as any;
    expect(collectDeepErrors(result.temporal_coverage)).toContain(
      "End date must be ≥ start date."
    );
    expect(collectDeepErrors(result.vertical_coverage.min_depth_in_m)).toEqual(
      []
    );
  });
});

describe("experimentCustomValidate", () => {
  it("enforces vertical coverage but NOT temporal", () => {
    const errors = makeErrors();
    const data = {
      // Experiment doesn't check temporal_coverage ordering — if we set a
      // bad ordering it should still not add an error for it.
      temporal_coverage: "2024-12-31/2024-01-01",
      vertical_coverage: { max_depth_in_m: 5 }
    };
    const result: any = experimentCustomValidate(data, errors, undefined);
    expect(collectDeepErrors(result.temporal_coverage)).toEqual([]);
    expect(collectDeepErrors(result.vertical_coverage.max_depth_in_m)).toContain(
      "Maximum depth must be 0 or negative (below sea surface)."
    );
  });
});
