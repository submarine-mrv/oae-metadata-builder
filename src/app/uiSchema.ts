// uiSchema.ts
const uiSchema = {
  "ui:order": [
    "project_id",
    "temporal_coverage",
    "spatial_coverage",
    "vertical_coverage",
    "sea_names",
    "project_description",
    "physical_site_description",
    "social_context_site_description",
    "social_research_conducted_to_date",
    "mcdr_pathway",
    "previous_or_ongoing_colocated_research",
    "colocated_operations",
    "permit_numbers",
    "*"
  ],

  temporal_coverage: {
    "ui:widget": "IsoIntervalWidget"
  },

  sea_names: {
    "ui:widget": "SeaNamesAutocomplete"
  },

  spatial_coverage: {
    "ui:field": "SpatialCoverageFlat"
  },

  vertical_coverage: {
    "ui:options": {
      gridCols: 2
    },
    min_depth_in_m: {
      "ui:widget": "updown",
      "ui:placeholder": "e.g., 0"
    },
    max_depth_in_m: {
      "ui:widget": "updown",
      "ui:placeholder": "e.g., 50"
    }
  },

  permit_numbers: {
    "ui:options": {
      addable: true,
      orderable: false
    },
    items: {
      "ui:placeholder": "e.g., CA-OAE-2025-001"
    },
    "ui:help": "Add all associated permits."
  },

  project_description: {
    "ui:widget": "textarea",
    "ui:options": { rows: 6 }
  },

  physical_site_description: {
    "ui:widget": "textarea",
    "ui:options": { rows: 5 }
  },

  social_context_site_description: {
    "ui:widget": "textarea",
    "ui:options": { rows: 5 }
  },

  social_research_conducted_to_date: {
    "ui:widget": "textarea",
    "ui:options": { rows: 4 }
  },

  previous_or_ongoing_colocated_research: {
    "ui:options": {
      addable: true,
      orderable: false
    },
    items: {
      // Use custom ExternalProject field that handles grid layout internally
      "ui:field": "ExternalProjectField"
    }
  },

  colocated_operations: {
    "ui:widget": "textarea",
    "ui:options": { rows: 3 }
  }
};

export default uiSchema;
