import { describe, expect, it } from "vitest";
import type { ExperimentRecord } from "@/types/forms";
import { emptyProjectState } from "@/workspace/types";
import { parseProjectState } from "../parseProjectState";

describe("parseProjectState", () => {
  it("returns an equivalent state for an empty project", () => {
    const parsed = parseProjectState(emptyProjectState());
    expect(parsed.experiments).toEqual([]);
    expect(parsed.datasets).toEqual([]);
    expect(parsed.nextExperimentId).toBe(1);
  });

  it("drops a stored top-level experiment_types copy", () => {
    const parsed = parseProjectState({
      ...emptyProjectState(),
      experiments: [
        {
          id: 1,
          name: "Exp",
          formData: { experiment_id: "E1", experiment_types: ["intervention"] },
          // Older saves duplicated formData.experiment_types here.
          experiment_types: ["model", "intervention"],
          createdAt: 1,
          updatedAt: 1,
        } as ExperimentRecord,
      ],
    });
    expect(parsed.experiments[0]).not.toHaveProperty("experiment_types");
    expect(parsed.experiments[0].formData.experiment_types).toEqual(["intervention"]);
  });
});
