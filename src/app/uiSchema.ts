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

const nestedItemStyle = {
  border: "1px solid #ccc",
  borderRadius: "5px",
  padding: "16px",
  margin: "8px 0",
  background: "#f9f9f9"
};

// // Old style ordering and UI customizations for react-jsonschema-form
const uiSchemaOld = {
  "ui:title": "",
  "ui:options": {
    expandable: false
  },
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
    "permits",
    "public_comments",
    "*"
  ],

  project_id: {
    "ui:style": { width: "50%" },
    "ui:placeholder": "Enter project ID"
  },

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
    "ui:style": { width: "320px" },
    "ui:widget": "CustomSelectWidget",
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
    "ui:style": { width: "50%" },
    "ui:options": {
      gridCols: 2
    },
    "ui:order": ["min_depth_in_m", "max_depth_in_m"]
  },
  sea_names: {
    "ui:style": { width: "66%" },
    "ui:widget": "CustomSelectWidget"
  },

  permit_numbers: {
    "ui:options": {
      addable: true,
      orderable: false
    },
    items: {
      "ui:placeholder": "e.g., CA-OAE-2025-001",
      "ui:options": { rows: 1 }
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
      "ui:field": "ExternalProjectField",
      "ui:style": nestedItemStyle
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
    items: {
      "ui:style": nestedItemStyle,
      "ui:order": [
        "permit_id",
        "permit_status",
        "permitting_authority",
        "approval_document"
      ],
      approval_document: {
        "ui:placeholder": "Type URL or DOI"
      }
    }
  }
};

export default uiSchemaOld;
