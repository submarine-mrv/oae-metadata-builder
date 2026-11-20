import { describe, expect, it } from "vitest";
import { mergeProjectRecord, reconcileProjectRecord } from "../merge";
import { emptyProjectState, newProjectRecord, type ProjectRecord } from "../types";

describe("project import reconciliation", () => {
  it("reports conflicting concurrent additions with the same experiment import identity", () => {
    const base = newProjectRecord();
    const added = (description: string) => ({
      ...base,
      state: {
        ...base.state,
        experiments: [
          {
            id: `added-${description}`,
            name: "E",
            formData: { experiment_id: "E", description },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    });
    expect(() => reconcileProjectRecord(added("A"), added("B"), base)).toThrow(
      'Newer changes also edited the experiment "E"',
    );
  });
  it("uses imported project fields and replaces matching experiments", () => {
    const target = newProjectRecord({
      ...emptyProjectState(),
      projectData: { project_id: "P", name: "local", description: "retained" },
      experiments: [
        {
          id: "1",
          name: "E",
          formData: { experiment_id: "E", description: "local" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const incoming = {
      ...target,
      state: {
        ...target.state,
        projectData: { project_id: "P", name: "remote" },
        experiments: [
          {
            ...target.state.experiments[0],
            formData: { experiment_id: "E", description: "remote" },
          },
        ],
      },
    };
    const merged = mergeProjectRecord(target, incoming);
    expect(merged.id).toBe(target.id);
    expect(merged.state.projectData).toMatchObject({ name: "remote", description: "retained" });
    expect(merged.state.experiments).toHaveLength(1);
    expect(merged.state.experiments[0].formData.description).toBe("remote");
  });

  describe("concurrent edits to one experiment or dataset", () => {
    const base = newProjectRecord(
      {
        ...emptyProjectState(),
        experiments: [
          {
            id: "1",
            name: "E",
            formData: { experiment_id: "E", description: "base", start_datetime: "2026-01-01" },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        datasets: [
          {
            id: "1",
            name: "D",
            formData: { name: "D", description: "base" },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      1,
    );
    const edit = (
      experiment: Record<string, unknown>,
      dataset: Record<string, unknown> = {},
    ): ProjectRecord => ({
      ...base,
      state: {
        ...base.state,
        experiments: [
          {
            ...base.state.experiments[0],
            formData: { ...base.state.experiments[0].formData, ...experiment },
            updatedAt: 2,
          },
        ],
        datasets: [
          {
            ...base.state.datasets[0],
            formData: { ...base.state.datasets[0].formData, ...dataset },
            updatedAt: 2,
          },
        ],
      },
    });

    it("merges edits to different fields", () => {
      const merged = reconcileProjectRecord(
        edit({ description: "local" }, { description: "local" }),
        edit({ start_datetime: "2026-02-02" }, { name: "D remote" }),
        base,
      );
      expect(merged.state.experiments[0].formData).toMatchObject({
        description: "local",
        start_datetime: "2026-02-02",
      });
      expect(merged.state.datasets[0].formData).toMatchObject({
        name: "D remote",
        description: "local",
      });
    });

    it("conflicts when one side changes the type and the other edits the same dataset", () => {
      expect(() =>
        reconcileProjectRecord(
          edit({}, { dataset_type: "model_output" }),
          edit({}, { description: "remote" }),
          base,
        ),
      ).toThrow('the type of dataset "D"');
    });

    it("refreshes a linked dataset's experiment ID after merging", () => {
      const local = edit({}, { description: "local" });
      local.state.datasets[0] = {
        ...local.state.datasets[0],
        linking: { linkedExperimentInternalId: "1" },
        formData: { ...local.state.datasets[0].formData, experiment_id: "E" },
      };
      const merged = reconcileProjectRecord(local, edit({ experiment_id: "E2" }), base);
      expect(merged.state.datasets[0].formData.experiment_id).toBe("E2");
    });

    it("conflicts when both sides change the same field", () => {
      expect(() =>
        reconcileProjectRecord(
          edit({ description: "local" }),
          edit({ description: "remote" }),
          base,
        ),
      ).toThrow('"Experiment Description" in experiment "E"');
    });
  });

  describe("settling conflicts with a preferred side", () => {
    const base = newProjectRecord(
      { ...emptyProjectState(), projectData: { name: "base", description: "base" } },
      1,
    );
    const withData = (data: Record<string, unknown>): ProjectRecord => ({
      ...base,
      state: { ...base.state, projectData: { ...base.state.projectData, ...data } },
    });
    const local = withData({ name: "local", purpose: "mine" });
    const remote = withData({ name: "remote", description: "theirs" });

    it("takes this side's value only where both edited", () => {
      expect(reconcileProjectRecord(local, remote, base, "local").state.projectData).toEqual({
        name: "local",
        description: "theirs",
        purpose: "mine",
      });
    });

    it("takes the newer value only where both edited", () => {
      expect(reconcileProjectRecord(local, remote, base, "remote").state.projectData).toEqual({
        name: "remote",
        description: "theirs",
        purpose: "mine",
      });
    });

    it("keeps the preferred side's whole entity on a type change", () => {
      const experiment = {
        id: "e",
        name: "E",
        formData: { experiment_id: "E", description: "base" },
        createdAt: 1,
        updatedAt: 1,
      };
      const start = newProjectRecord({ ...emptyProjectState(), experiments: [experiment] }, 1);
      const change = (formData: Record<string, unknown>): ProjectRecord => ({
        ...start,
        state: {
          ...start.state,
          experiments: [{ ...experiment, formData: { ...experiment.formData, ...formData } }],
        },
      });
      const mine = change({ experiment_types: ["control"] });
      const theirs = change({ description: "theirs" });
      const settled = (prefer: "local" | "remote") =>
        reconcileProjectRecord(mine, theirs, start, prefer).state.experiments[0].formData;
      expect(settled("remote")).toMatchObject({ description: "theirs" });
      expect(settled("remote")).not.toHaveProperty("experiment_types");
      expect(settled("local")).toMatchObject({
        description: "base",
        experiment_types: ["control"],
      });
    });
  });

  describe("experiments added on both sides", () => {
    const base = newProjectRecord({ ...emptyProjectState() }, 1);
    const withAddition = (
      description?: string,
      linkedDataset = false,
      id = "remote-experiment",
    ): ProjectRecord => ({
      ...base,
      state: {
        ...base.state,
        experiments: [
          {
            id,
            name: "Experiment 1",
            formData: description ? { description } : {},
            createdAt: 2,
            updatedAt: 2,
          },
        ],
        datasets: linkedDataset
          ? [
              {
                id: `${id}-dataset`,
                name: "D",
                formData: { name: "D" },
                linking: { linkedExperimentInternalId: id },
                createdAt: 2,
                updatedAt: 2,
              },
            ]
          : [],
      },
    });

    it("keeps both sides' additions, each with its own ID and links", () => {
      const merged = reconcileProjectRecord(
        withAddition("local", false, "local-experiment"),
        withAddition("remote", true),
        base,
      );
      expect(merged.state.experiments.map((experiment) => experiment.id)).toEqual([
        "local-experiment",
        "remote-experiment",
      ]);
      expect(merged.state.datasets[0].linking?.linkedExperimentInternalId).toBe(
        "remote-experiment",
      );
    });

    it("gives a remote addition the project ID changed here", () => {
      const local = {
        ...base,
        state: { ...base.state, projectData: { ...base.state.projectData, project_id: "P2" } },
      };
      const merged = reconcileProjectRecord(local, withAddition("remote", true), base);
      expect(merged.state.experiments[0].formData.project_id).toBe("P2");
      expect(merged.state.datasets[0].formData.project_id).toBe("P2");
    });

    it("keeps one copy when a lost save reply makes this tab's addition look remote", () => {
      const own = withAddition("mine", true);
      const merged = reconcileProjectRecord(own, own, base);
      expect(merged.state.experiments).toHaveLength(1);
      expect(merged.state.datasets).toHaveLength(1);
    });

    it("conflicts when that addition was edited elsewhere before this tab retried", () => {
      expect(() =>
        reconcileProjectRecord(withAddition("mine", true), withAddition("theirs", true), base),
      ).toThrow("the experiment");
    });

    it("keeps a remote addition's ID and links when nothing was added here", () => {
      const merged = reconcileProjectRecord(base, withAddition("remote", true), base);
      expect(merged.state.experiments.map((experiment) => experiment.id)).toEqual([
        "remote-experiment",
      ]);
      expect(merged.state.datasets[0].linking?.linkedExperimentInternalId).toBe(
        "remote-experiment",
      );
    });
  });

  describe("deletes win over concurrent edits", () => {
    const experiment = (description: string) => ({
      id: "1",
      name: "E",
      formData: { experiment_id: "E", description },
      createdAt: 1,
      updatedAt: 1,
    });
    const withExperiments = (experiments: ReturnType<typeof experiment>[]) =>
      newProjectRecord({ ...emptyProjectState(), experiments }, 1);
    const base = withExperiments([experiment("original")]);

    it("drops an entity deleted elsewhere even though it was edited here", () => {
      const local = { ...withExperiments([experiment("edited here")]), id: base.id };
      const remote = { ...withExperiments([]), id: base.id };
      expect(reconcileProjectRecord(local, remote, base).state.experiments).toEqual([]);
    });

    it("keeps an entity deleted here even though it was edited elsewhere", () => {
      const local = { ...withExperiments([]), id: base.id };
      const remote = { ...withExperiments([experiment("edited elsewhere")]), id: base.id };
      expect(reconcileProjectRecord(local, remote, base).state.experiments).toEqual([]);
    });
  });

  it("preserves distinct equal datasets and distinguishes their experiment links", () => {
    const target = newProjectRecord({
      ...emptyProjectState(),
      projectData: { project_id: "P" },
      experiments: [
        {
          id: "1",
          name: "E",
          formData: { experiment_id: "E", project_id: "P" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      datasets: [
        {
          id: "1",
          name: "D",
          formData: { name: "D", project_id: "P" },
          linking: { linkedExperimentInternalId: null },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const incoming = {
      ...target,
      state: {
        ...target.state,
        datasets: [
          target.state.datasets[0],
          { ...target.state.datasets[0], id: "2" },
          { ...target.state.datasets[0], id: "3", linking: { linkedExperimentInternalId: "1" } },
        ],
      },
    };
    const merged = mergeProjectRecord(target, incoming);
    expect(merged.state.datasets).toHaveLength(3);
    expect(merged.state.datasets[2].linking?.linkedExperimentInternalId).toBe("1");
    expect(mergeProjectRecord(merged, incoming)).toBe(merged);
  });

  it("preserves disjoint local and remote experiment edits using the common baseline", () => {
    const base = newProjectRecord({
      ...emptyProjectState(),
      experiments: [1, 2].map((id) => ({
        id: String(id),
        name: `E${id}`,
        formData: { experiment_id: `E${id}`, description: "base" },
        createdAt: 1,
        updatedAt: 1,
      })),
    });
    const local = {
      ...base,
      state: {
        ...base.state,
        experiments: base.state.experiments.map((experiment) =>
          experiment.id === "1"
            ? { ...experiment, formData: { ...experiment.formData, description: "local" } }
            : experiment,
        ),
      },
    };
    const remote = {
      ...base,
      state: {
        ...base.state,
        experiments: base.state.experiments.map((experiment) =>
          experiment.id === "2"
            ? { ...experiment, formData: { ...experiment.formData, description: "remote" } }
            : experiment,
        ),
      },
    };
    const merged = reconcileProjectRecord(local, remote, base);
    expect(merged.state.experiments.map((experiment) => experiment.formData.description)).toEqual([
      "local",
      "remote",
    ]);
    expect(() =>
      reconcileProjectRecord(
        local,
        {
          ...remote,
          state: {
            ...remote.state,
            experiments: remote.state.experiments.map((experiment) => ({
              ...experiment,
              formData: { ...experiment.formData, description: "overlap" },
            })),
          },
        },
        base,
      ),
    ).toThrow("Newer changes also edited");
  });
  it("preserves links and deduplicates datasets when retrying the same import", () => {
    const target = newProjectRecord({
      ...emptyProjectState(),
      projectData: { project_id: "P" },
    });
    const incoming = newProjectRecord({
      ...emptyProjectState(),
      projectData: { project_id: "P" },
      experiments: [
        {
          id: "5",
          name: "E",
          formData: { experiment_id: "E", project_id: "P" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      datasets: [
        {
          id: "7",
          name: "D",
          formData: { name: "D", experiment_id: "E", project_id: "P" },
          linking: { linkedExperimentInternalId: "5" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const merged = mergeProjectRecord(target, incoming);
    expect(merged.state.datasets[0].linking?.linkedExperimentInternalId).toBe(
      merged.state.experiments[0].id,
    );
    expect(mergeProjectRecord(merged, incoming)).toBe(merged);
    expect(merged.state.datasets).toHaveLength(1);
  });
});
