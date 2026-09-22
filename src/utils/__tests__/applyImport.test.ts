import { describe, expect, it } from "vitest";
import { emptyProjectState } from "@/workspace/types";
import { applyImport } from "../applyImport";

describe("applyImport", () => {
  it("adds experiments and datasets to an empty project and links by import key", () => {
    const result = applyImport(emptyProjectState(), {
      project: { project_id: "P1", research_project: "Imported" },
      experiments: [{ experiment_id: "E1", name: "First" }],
      datasets: [
        {
          formData: { name: "DS" },
          experimentLinking: {
            mode: "use-file",
            resolvedMatch: { type: "importing", importKey: "experiment-0" },
          },
        },
      ],
    });

    expect(result.projectData.research_project).toBe("Imported");
    expect(result.experiments).toHaveLength(1);
    expect(result.experiments[0].id).toBe(1);
    expect(result.nextExperimentId).toBe(2);
    expect(result.datasets[0].linking?.linkedExperimentInternalId).toBe(1);
    expect(result.datasets[0].formData.experiment_id).toBe("E1");
    expect(result.nextDatasetId).toBe(2);
  });

  it("replaces an experiment with a matching experiment_id instead of duplicating it", () => {
    const prev = applyImport(emptyProjectState(), {
      project: null,
      experiments: [{ experiment_id: "E1", name: "Old" }],
      datasets: [],
    });
    const result = applyImport(prev, {
      project: null,
      experiments: [{ experiment_id: "E1", name: "New" }],
      datasets: [],
    });
    expect(result.experiments).toHaveLength(1);
    expect(result.experiments[0].name).toBe("New");
  });

  it("drops a link to an experiment that isn't in the resulting project", () => {
    const result = applyImport(emptyProjectState(), {
      project: null,
      experiments: [],
      datasets: [
        {
          formData: { name: "DS", experiment_id: "E9" },
          experimentLinking: {
            mode: "use-file",
            resolvedMatch: { type: "existing", experimentId: "E9", internalId: 7 },
          },
        },
        {
          formData: { name: "DS2" },
          experimentLinking: { mode: "explicit", explicitExperimentInternalId: 7 },
        },
      ],
    });
    expect(result.datasets[0].linking?.linkedExperimentInternalId).toBeNull();
    expect(result.datasets[0].formData.experiment_id).toBe("E9");
    expect(result.datasets[1].linking?.linkedExperimentInternalId).toBeNull();
  });
});
