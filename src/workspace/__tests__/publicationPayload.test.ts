import { describe, expect, it } from "vitest";
import { buildMetadataDocument } from "@/utils/exportImport";
import { buildProjectPublicationPayload } from "../publicationPayload";
import { publicationProject } from "./publicationFixtures";

describe("complete project publication payload", () => {
  it("uses the export document and preserves full person fields and absent optional values", () => {
    const project = publicationProject();
    const payload = buildProjectPublicationPayload(project);
    expect(payload.project.extras).toEqual({
      _source: project.state.projectData,
      _source_file: "PUBLICATION-TEST.json",
      metadata_builder_git_hash: "",
      _document: buildMetadataDocument(
        project.state.projectData,
        project.state.experiments,
        project.state.datasets,
      ),
    });
    expect(payload.experiments[0].end_datetime).toBeNull();
    expect(payload.experiments[0].extras).toEqual({
      _source: project.state.experiments[0].formData,
    });
    expect(payload.datasets[0].data_submitter).toEqual(
      project.state.datasets[0].formData.data_submitter,
    );
    expect(payload.datasets[0].simulation_type).toBeNull();
    expect(payload.datasets[0].extras).toEqual({ _source: project.state.datasets[0].formData });
    expect(payload.project).not.toHaveProperty("published");
    expect(payload.project).not.toHaveProperty("owner_id");
  });

  it("blocks invalid project, experiment and dataset metadata", () => {
    const project = publicationProject();
    project.state.projectData.name = "";
    expect(() => buildProjectPublicationPayload(project)).toThrow("Project name");
    const experiment = publicationProject();
    experiment.state.experiments[0].formData.name = "";
    expect(() => buildProjectPublicationPayload(experiment)).toThrow("Experiment");
    const dataset = publicationProject();
    dataset.state.datasets[0].formData.dataset_type = "invalid-type";
    expect(() => buildProjectPublicationPayload(dataset)).toThrow("Dataset");
  });

  it("rejects foreign links and duplicate experiment IDs rather than publishing a partial tree", () => {
    const experiment = publicationProject();
    experiment.state.experiments[0].formData.project_id = "other-project";
    expect(() => buildProjectPublicationPayload(experiment)).toThrow("must link");
    const dataset = publicationProject();
    dataset.state.datasets[0].formData.experiment_id = "missing-experiment";
    expect(() => buildProjectPublicationPayload(dataset)).toThrow("must link");
    const duplicate = publicationProject();
    duplicate.state.experiments.push({ ...duplicate.state.experiments[0], id: 2 });
    expect(() => buildProjectPublicationPayload(duplicate)).toThrow("unique");
  });

  it("publishes the whole current tree without mutating the draft", () => {
    const project = publicationProject();
    const before = structuredClone(project);
    const payload = buildProjectPublicationPayload(project);
    expect(payload.experiments).toHaveLength(1);
    expect(payload.datasets).toHaveLength(1);
    expect(project).toEqual(before);
  });
});
