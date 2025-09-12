// uiSchema.ts

// Grid style does not actually work as intenteded with "addable" fields
// once you edit an added element in the array, the entire entry collapses
// so we are not using this for now.
//
// const uiSchemaGrid = {
//   "ui:field": "LayoutGridField",
//   "ui:layoutGrid": {
//     "ui:row": [
//       { "ui:row": [{ "ui:col": ["project_id"] }] },
//       { "ui:row": [{ "ui:col": ["sea_names"] }] },
//       { "ui:row": [{ "ui:col": ["project_description"] }] },
//       { "ui:row": [{ "ui:col": ["permit_numbers"] }] }
//     ]
//   },
//   project_description: {
//     "ui:widget": "textarea",
//     "ui:options": { rows: 6 }
//   },

//   previous_or_ongoing_colocated_research: {
//     "ui:options": {
//       addable: true,
//       orderable: false
//     },
//     items: {
//       "ui:field": "ExternalProjectField"
//     }
//   }
// };

// // Old style ordering and UI customizations for react-jsonschema-form
const uiSchemaOld = {
  "ui:order": [
    "project_id",
    "temporal_coverage",
    "coverage_section",
    "vertical_coverage",
    "spatial_coverage",
    "sea_names",
    "project_description",
    "physical_site_description",
    "social_context_site_description",
    "social_research_conducted_to_date",
    "mcdr_pathway",
    "previous_or_ongoing_colocated_research",
    "colocated_operations",
    "permits"
  ],

  temporal_coverage: {
    "ui:widget": "IsoIntervalWidget",
    "ui:title": "Temporal Coverage",
    "ui:style": { width: "50%" }
  },

  spatial_coverage: {
    "ui:field": "SpatialCoverageMiniMap",
    "ui:title": "Spatial Coverage"
  },

  mcdr_pathway: {
    "ui:enumNames": [
      "Ocean Alkalinity Enhancement",
      "Biomass Sinking",
      "Direct Ocean Capture",
      "Ocean Nutrient Fertilization",
      "Artificial Upwelling and Downwelling",
      "Marine Ecosystem Recovery"
    ]
  },

  vertical_coverage: {
    "ui:title": "Vertical Coverage",
    "ui:options": {
      gridCols: 2
    },
    "ui:style": { width: "50%" }
  },
  sea_names: {
    "ui:style": { width: "66%" }
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
      "ui:field": "ExternalProjectField"
    }
  },

  colocated_operations: {
    "ui:widget": "textarea",
    "ui:options": { rows: 3 }
  },

  permits: {
    "ui:options": {
      addable: true,
      orderable: false
    },
    "ui:order": [
      "permit_id",
      "permitting_authority",
      "permit_status",
      "permit_document"
    ]
  }
};

export default uiSchemaOld;
