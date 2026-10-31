import { describe, expect, it } from "vitest";
import { mergeProjectRecord, reconcileProjectRecord } from "../merge";
import { emptyProjectState, newProjectRecord } from "../types";

describe("project import reconciliation", () => {
  it("reports conflicting concurrent additions with the same experiment import identity", () => {
    const base = newProjectRecord();
    const added = (description: string) => ({
      ...base,
      state: {
        ...base.state,
        experiments: [
          {
            id: 1,
            name: "E",
            formData: { experiment_id: "E", description },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        nextExperimentId: 2,
      },
    });
    expect(() => reconcileProjectRecord(added("A"), added("B"), base)).toThrow(
      'Conflicting changes to new experiment "E"',
    );
  });
  it("uses imported project fields and replaces matching experiments", () => {
    const target = newProjectRecord({
      ...emptyProjectState(),
      projectData: { project_id: "P", name: "local", description: "retained" },
      experiments: [
        {
          id: 1,
          name: "E",
          formData: { experiment_id: "E", description: "local" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      nextExperimentId: 2,
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

  describe("deletes win over concurrent edits", () => {
    const experiment = (description: string) => ({
      id: 1,
      name: "E",
      formData: { experiment_id: "E", description },
      createdAt: 1,
      updatedAt: 1,
    });
    const withExperiments = (experiments: ReturnType<typeof experiment>[]) =>
      newProjectRecord({ ...emptyProjectState(), experiments, nextExperimentId: 2 }, 1);
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
          id: 1,
          name: "E",
          formData: { experiment_id: "E", project_id: "P" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      datasets: [
        {
          id: 1,
          name: "D",
          formData: { name: "D", project_id: "P" },
          linking: { linkedExperimentInternalId: null },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      nextExperimentId: 2,
      nextDatasetId: 2,
    });
    const incoming = {
      ...target,
      state: {
        ...target.state,
        datasets: [
          target.state.datasets[0],
          { ...target.state.datasets[0], id: 2 },
          { ...target.state.datasets[0], id: 3, linking: { linkedExperimentInternalId: 1 } },
        ],
        nextDatasetId: 4,
      },
    };
    const merged = mergeProjectRecord(target, incoming);
    expect(merged.state.datasets).toHaveLength(3);
    expect(merged.state.datasets[2].linking?.linkedExperimentInternalId).toBe(1);
    expect(mergeProjectRecord(merged, incoming)).toBe(merged);
  });

  it("preserves disjoint local and remote experiment edits using the common baseline", () => {
    const base = newProjectRecord({
      ...emptyProjectState(),
      experiments: [1, 2].map((id) => ({
        id,
        name: `E${id}`,
        formData: { experiment_id: `E${id}`, description: "base" },
        createdAt: 1,
        updatedAt: 1,
      })),
      nextExperimentId: 3,
    });
    const local = {
      ...base,
      state: {
        ...base.state,
        experiments: base.state.experiments.map((experiment) =>
          experiment.id === 1
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
          experiment.id === 2
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
    ).toThrow("Conflicting changes");
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
          id: 5,
          name: "E",
          formData: { experiment_id: "E", project_id: "P" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      datasets: [
        {
          id: 7,
          name: "D",
          formData: { name: "D", experiment_id: "E", project_id: "P" },
          linking: { linkedExperimentInternalId: 5 },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      nextExperimentId: 6,
      nextDatasetId: 8,
    });
    const merged = mergeProjectRecord(target, incoming);
    expect(merged.state.datasets[0].linking?.linkedExperimentInternalId).toBe(
      merged.state.experiments[0].id,
    );
    expect(mergeProjectRecord(merged, incoming)).toBe(merged);
    expect(merged.state.datasets).toHaveLength(1);
  });
});
