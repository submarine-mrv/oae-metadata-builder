import { describe, expect, it } from "vitest";
import type { ExperimentTypes } from "@/types/forms";
import { emptyProjectState } from "@/workspace/types";
import { parseProjectState } from "../parseProjectState";

describe("parseProjectState", () => {
  it("returns an equivalent state for an empty project", () => {
    const parsed = parseProjectState(emptyProjectState());
    expect(parsed.experiments).toEqual([]);
    expect(parsed.datasets).toEqual([]);
    expect(parsed.nextExperimentId).toBe(1);
  });

  it("re-derives experiment_types from the parsed form data", () => {
    const parsed = parseProjectState({
      ...emptyProjectState(),
      experiments: [
        {
          id: 1,
          name: "Exp",
          formData: { experiment_id: "E1", experiment_types: ["intervention"] },
          // A stale legacy value the type forbids; the parse normalizes it away.
          experiment_types: ["model", "intervention"] as unknown as ExperimentTypes,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(parsed.experiments[0].experiment_types).toEqual(
      parsed.experiments[0].formData.experiment_types,
    );
  });
});
