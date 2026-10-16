import { describe, expect, it } from "vitest";
import { buildProjectPublicationPayload } from "../publicationPayload";
import type { ProjectRecord } from "../types";

const project = (): ProjectRecord => ({
  id: "record-id",
  createdAt: 1,
  updatedAt: 2,
  state: {
    projectData: {
      project_id: "PUBLISH-1",
      research_project: "Publication test",
      description: "A complete project",
      mcdr_pathway: "ocean_alkalinity_enhancement",
      spatial_coverage: { geo: { box: "-124 47 -122 48" } },
      temporal_coverage: "2024-01-01/2024-12-31",
      project_leads: [],
      sea_names: [],
    },
    experiments: [
      {
        id: 1,
        name: "Baseline",
        createdAt: 1,
        updatedAt: 2,
        formData: {
          project_id: "PUBLISH-1",
          experiment_id: "PUBLISH-1-EXP-1",
          name: "Baseline",
          description: "Baseline measurements",
          experiment_types: ["baseline"],
          spatial_coverage: { geo: { box: "-124 47 -122 48" } },
          experiment_leads: [],
          start_datetime: "2024-01-01T00:00:00Z",
        },
      },
    ],
    datasets: [
      {
        id: 1,
        name: "Water samples",
        createdAt: 1,
        updatedAt: 2,
        linking: { linkedExperimentInternalId: 1 },
        formData: {
          project_id: "PUBLISH-1",
          experiment_id: "PUBLISH-1-EXP-1",
          name: "Water samples",
          description: "Water sample dataset",
          temporal_coverage: "2024-01-01/2024-12-31",
          dataset_type: "bottle",
          data_product_type: "originally_collected_dataset",
          platform_info: {
            platform_type: "http://vocab.nerc.ac.uk/collection/L06/current/62/",
          },
          data_submitter: { name: "Researcher", role: "PI", email: "researcher@example.org" },
          filenames: ["samples.csv"],
          data_accessibility: "open_access",
          data_access_link: "https://doi.org/10.1234/example",
        },
      },
    ],
    nextExperimentId: 2,
    nextDatasetId: 2,
  },
});

describe("buildProjectPublicationPayload", () => {
  it("maps a complete project tree to the normalized Web catalog row contract", () => {
    const payload = buildProjectPublicationPayload(project());

    expect(payload.project).toMatchObject({
      project_id: "PUBLISH-1",
      temporal_coverage: "2024-01-01/2024-12-31",
      extras: {
        _source_file: "PUBLISH-1.json",
        _source: { research_project: "Publication test" },
      },
    });
    expect(payload.experiments[0]).toMatchObject({
      project_id: "PUBLISH-1",
      experiment_id: "PUBLISH-1-EXP-1",
      start_datetime: "2024-01-01T00:00:00.000Z",
      extras: { _source: { name: "Baseline" } },
    });
    expect(payload.datasets[0]).toMatchObject({
      project_id: "PUBLISH-1",
      experiment_id: "PUBLISH-1-EXP-1",
      name: "Water samples",
      filenames: ["samples.csv"],
      extras: { _source: { name: "Water samples" } },
    });
  });

  it("blocks a project with missing required metadata", () => {
    const invalid = project();
    invalid.state.projectData.description = "";

    expect(() => buildProjectPublicationPayload(invalid)).toThrow(
      /Project description is required/,
    );
  });

  it("blocks datasets that cannot be represented under an experiment", () => {
    const invalid = project();
    invalid.state.experiments = [];

    expect(() => buildProjectPublicationPayload(invalid)).toThrow(
      /must link to an experiment in this project/,
    );
  });

  it("blocks child rows whose project IDs do not match the project", () => {
    const invalid = project();
    invalid.state.experiments[0].formData.project_id = "OTHER";

    expect(() => buildProjectPublicationPayload(invalid)).toThrow(
      /is not linked to project "PUBLISH-1"/,
    );
  });
});
