// experimentUiSchema.ts - UI configuration for experiment forms
import schema from "../../../public/experiment.schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";

// Generate formatted enum names from schema
const enumNames = generateEnumNames(schema, [
  "ExperimentType",
  "ResearcherIDType"
]);

const nestedItemStyle = {
  border: "1px solid #ccc",
  borderRadius: "5px",
  padding: "16px",
  margin: "8px 0",
  background: "#f9f9f9"
};

const textAreaWidget = {
  "ui:widget": "textarea",
  "ui:options": { rows: 5 },
  "ui:descriptionModal": true
};

const halfWidthStyle = {
  "ui:style": { width: "50%" }
};

const experimentUiSchema = {
  "ui:title": "",
  "ui:options": {
    expandable: false
  },
  "ui:order": [
    "name",
    "experiment_id",
    "experiment_type",
    "description",
    "start_datetime",
    "end_datetime",
    "spatial_coverage",
    "vertical_coverage",
    "investigators",
    "permits",
    "meteorological_and_tidal_data",
    "data_conflicts_and_unreported_data",
    "additional_details",
    "*"
  ],
  experiment_id: {
    ...halfWidthStyle,
    "ui:placeholder": "e.g., PROJECT-01-BASELINE-01",
    "ui:descriptionModal": true
  },
  name: {
    ...halfWidthStyle,
    "ui:title": "Experiment Name",
    "ui:placeholder": "e.g., Baseline Water Chemistry Study"
  },
  experiment_type: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.ExperimentType
    }
  },
  description: textAreaWidget,
  start_datetime: {
    ...halfWidthStyle,
    "ui:widget": "DateTimeWidget"
  },
  end_datetime: {
    ...halfWidthStyle,
    "ui:widget": "DateTimeWidget"
  },
  spatial_coverage: {
    "ui:field": "SpatialCoverageMiniMap",
    "ui:title": "Spatial Coverage"
  },
  vertical_coverage: {
    ...halfWidthStyle,
    "ui:options": {
      gridCols: 2
    },
    "ui:order": ["min_depth_in_m", "max_depth_in_m"]
  },
  investigators: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Investigator"
    },
    items: {
      "ui:style": nestedItemStyle,
      "ui:options": {
        gridCols: 2
      },
      "ui:order": [
        "name",
        "email",
        "role",
        "phone",
        "identifier_type",
        "identifier",
        "affiliation"
      ],
      name: {
        "ui:placeholder": "Full name"
      },
      email: {
        "ui:placeholder": "email@example.com"
      },
      phone: {
        "ui:placeholder": "+1-555-555-5555"
      },
      role: {
        "ui:placeholder": "e.g., Principal Investigator"
      },
      identifier_type: {
        "ui:widget": "CustomSelectWidget",
        "ui:options": {
          enumNames: enumNames.ResearcherIDType
        }
      },
      identifier: {
        "ui:placeholder": "e.g., 0000-0000-0000-0000"
      },
      affiliation: {
        "ui:order": ["name", "identifier", "country"],
        name: {
          "ui:title": "Organization Name",
          "ui:placeholder": "Organization name"
        },
        identifier: {
          "ui:title": "Organization Identifier",
          "ui:placeholder": "e.g., ROR URL (https://ror.org/...)"
        },
        country: {
          "ui:placeholder": "e.g., US"
        }
      }
    }
  },
  permits: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Permit"
    },
    items: {
      "ui:style": nestedItemStyle,
      "ui:options": {
        gridCols: 2
      },
      "ui:title": "",
      "ui:order": [
        "permit_id",
        "approval_document",
        "permitting_authority",
        "agency_contact",
        "time_period",
        "permit_type",
        "changes_to_evolution_of_permit_criteria"
      ]
    }
  },
  meteorological_and_tidal_data: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Dataset Reference"
    },
    items: {
      "ui:title": "",
      "ui:style": nestedItemStyle,
      "ui:options": {
        gridCols: 2
      },
      name: {
        "ui:placeholder": "Dataset name"
      },
      url: {
        "ui:placeholder": "URL or DOI (e.g. https://...)"
      }
    }
  },
  data_conflicts_and_unreported_data: textAreaWidget,
  additional_details: textAreaWidget,
  project_id: {
    "ui:widget": "hidden"
  }
};

export default experimentUiSchema;
