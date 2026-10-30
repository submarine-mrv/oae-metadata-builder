import { emptyProjectState, newProjectRecord } from "../types";

export function publicationProject() {
  const person = {
    name: "Publication Test",
    email: "publication@example.com",
    affiliation: { name: "Test Organization", identifier: "https://ror.org/012345678" },
  };
  const spatial = { geo: { box: "47 -124 48 -122" } };
  return {
    ...newProjectRecord(emptyProjectState(), 100),
    id: "publication-draft",
    state: {
      projectData: {
        project_id: "PUBLICATION-TEST",
        name: "Publication test project",
        description: "Synthetic project for publication verification",
        temporal_coverage: "2024-01-01/2024-12-31",
        spatial_coverage: spatial,
        project_leads: [person],
        mcdr_pathway: "ocean_alkalinity_enhancement",
      },
      experiments: [
        {
          id: 1,
          name: "Baseline",
          createdAt: 100,
          updatedAt: 100,
          formData: {
            project_id: "PUBLICATION-TEST",
            experiment_id: "PUBLICATION-EXP",
            name: "Baseline",
            description: "Synthetic baseline experiment",
            spatial_coverage: spatial,
            experiment_types: ["baseline"] as ["baseline"],
            experiment_leads: [person],
            start_datetime: "2024-01-01T00:00:00Z",
          },
        },
      ],
      datasets: [
        {
          id: 1,
          name: "Test observations",
          createdAt: 100,
          updatedAt: 100,
          linking: { linkedExperimentInternalId: 1 },
          formData: {
            project_id: "PUBLICATION-TEST",
            experiment_id: "PUBLICATION-EXP",
            name: "Test observations",
            description: "Synthetic observations",
            temporal_coverage: "2024-01-01/2024-12-31",
            dataset_type: "cast",
            data_product_type: "originally_collected_dataset",
            platform_info: {
              platform_type: "http://vocab.nerc.ac.uk/collection/L06/current/62/",
            },
            filenames: ["observations.csv"],
            data_submitter: person,
            data_accessibility: "open_access",
            data_access_link: "https://example.com/observations",
          },
        },
      ],
      nextExperimentId: 2,
      nextDatasetId: 2,
    },
  };
}
