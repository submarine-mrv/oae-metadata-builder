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
    expect(result.datasets[0].formData.experiment_id).toBeUndefined();
    expect(result.datasets[1].linking?.linkedExperimentInternalId).toBeNull();
  });

  it("resolves each linking mode to an internal id", () => {
    const prev = applyImport(emptyProjectState(), {
      project: null,
      experiments: [{ experiment_id: "E1" }],
      datasets: [],
    });
    const result = applyImport(prev, {
      project: null,
      experiments: [{ experiment_id: "E2" }],
      datasets: [
        {
          formData: { name: "existing" },
          experimentLinking: {
            mode: "use-file",
            resolvedMatch: { type: "existing", experimentId: "E1", internalId: 1 },
          },
        },
        {
          formData: { name: "explicit import key" },
          experimentLinking: { mode: "explicit", explicitImportKey: "experiment-0" },
        },
        {
          formData: { name: "none", experiment_id: "E9" },
          experimentLinking: { mode: "use-file", resolvedMatch: { type: "none" } },
        },
      ],
    });
    const links = result.datasets.map((d) => [
      d.linking?.linkedExperimentInternalId,
      d.formData.experiment_id,
    ]);
    expect(links).toEqual([
      [1, "E1"],
      [2, "E2"],
      [null, undefined],
    ]);
    expect(result.datasets[2].formData).not.toHaveProperty("experiment_id");
  });

  describe("ids come from the target project, not the file", () => {
    const withProject = (projectId: string) =>
      applyImport(emptyProjectState(), {
        project: { project_id: projectId },
        experiments: [{ experiment_id: "E1", name: "Existing" }],
        datasets: [{ formData: { name: "Existing DS" } }],
      });

    it("merge stamps the current project's project_id on imported experiments and datasets", () => {
      const result = applyImport(withProject("CURRENT"), {
        project: null,
        experiments: [{ experiment_id: "E2", project_id: "FOREIGN" }],
        datasets: [{ formData: { name: "DS", project_id: "FOREIGN" } }],
      });
      expect(result.experiments.map((e) => e.formData.project_id)).toEqual(["CURRENT", "CURRENT"]);
      expect(result.datasets.map((d) => d.formData.project_id)).toEqual(["CURRENT", "CURRENT"]);
    });

    it("import as a new project uses the file project's id", () => {
      const result = applyImport(emptyProjectState(), {
        project: { project_id: "FILE" },
        experiments: [{ experiment_id: "E1", project_id: "OTHER" }],
        datasets: [{ formData: { name: "DS", project_id: "OTHER" } }],
      });
      expect(result.experiments[0].formData.project_id).toBe("FILE");
      expect(result.datasets[0].formData.project_id).toBe("FILE");
    });

    it("gives an empty project_id when there is no project data", () => {
      const result = applyImport(emptyProjectState(), {
        project: null,
        experiments: [{ experiment_id: "E1", project_id: "FOREIGN" }],
        datasets: [{ formData: { name: "DS", project_id: "FOREIGN" } }],
      });
      expect(result.experiments[0].formData.project_id).toBe("");
      expect(result.datasets[0].formData.project_id).toBe("");
    });

    it("removes experiment_id from an unlinked dataset", () => {
      const result = applyImport(emptyProjectState(), {
        project: null,
        experiments: [],
        datasets: [{ formData: { name: "DS", experiment_id: "FOREIGN" } }],
      });
      expect(result.datasets[0].linking?.linkedExperimentInternalId).toBeNull();
      expect(result.datasets[0].formData).not.toHaveProperty("experiment_id");
    });

    it("sets a linked dataset's experiment_id from its experiment", () => {
      const result = applyImport(withProject("P"), {
        project: null,
        experiments: [],
        datasets: [
          {
            formData: { name: "DS", experiment_id: "FOREIGN" },
            experimentLinking: { mode: "explicit", explicitExperimentInternalId: 1 },
          },
        ],
      });
      expect(result.datasets[1].linking?.linkedExperimentInternalId).toBe(1);
      expect(result.datasets[1].formData.experiment_id).toBe("E1");
    });

    it("importing only project data updates existing records' project_id", () => {
      const result = applyImport(withProject("OLD"), {
        project: { project_id: "NEW" },
        experiments: [],
        datasets: [],
      });
      expect(result.experiments[0].formData.project_id).toBe("NEW");
      expect(result.datasets[0].formData.project_id).toBe("NEW");
    });

    it("leaves an existing record whose project_id already matches untouched", () => {
      const prev = withProject("P");
      const result = applyImport(prev, {
        project: null,
        experiments: [{ experiment_id: "E2" }],
        datasets: [],
      });
      expect(result.experiments[0]).toBe(prev.experiments[0]);
      expect(result.experiments[0].updatedAt).toBe(prev.experiments[0].updatedAt);
      expect(result.datasets[0]).toBe(prev.datasets[0]);
    });
  });
});
