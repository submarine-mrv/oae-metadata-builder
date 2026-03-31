// fieldExperimentUiSchema.ts - Consolidated UI configuration for all field experiment types
// (baseline, control, intervention, tracer, intervention+tracer, other)
//
// RJSF silently ignores ui:order entries for fields not in the active schema,
// so one master ordering works for all field experiment types.
// Model experiments use a separate modelUiSchema.
//
// See docs/experiment-type-multi-select.md for schema selection rules.

import schema from "../../../public/schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";
import {
  textAreaWidget,
  nestedItemStyle,
  halfWidthStyle
} from "../uiSchemaConstants";

const enumNames = generateEnumNames(schema, [
  "ResearcherIDType",
  "FeedstockType",
  "AlkalinityFeedstockForm",
  "AlkalinityFeedstockProcessing",
  "EquilibrationStatus",
  "TracerForm",
  "HydrologicLocation",
  "DosingDeliveryType"
]);

const fieldExperimentUiSchema = {
  "ui:title": "",
  "ui:options": {
    expandable: false
  },
  "ui:order": [
    "name",
    "experiment_id",
    "experiment_types",
    "description",
    "start_datetime",
    "end_datetime",
    "spatial_coverage",
    "vertical_coverage",
    // Intervention fields (ignored when schema doesn't include them)
    "alkalinity_feedstock_processing",
    "alkalinity_feedstock_processing_custom",
    "alkalinity_feedstock_form",
    "alkalinity_feedstock",
    "alkalinity_feedstock_custom",
    "alkalinity_feedstock_co2_removal_potential",
    "alkalinity_feedstock_description",
    "equilibration",
    "alkalinity_dosing_effluent_density",
    // Tracer fields (ignored when schema doesn't include them)
    "tracer_form",
    "tracer_form_custom",
    "tracer_details",
    "tracer_concentration",
    // Shared dosing fields (DosingDetails mixin — on Intervention, Tracer, and combined)
    "dosing_location",
    "dosing_dispersal_hydrologic_location",
    "dosing_delivery_type",
    "dosing_depth",
    "dosing_description",
    "dosing_regimen",
    // Common tail
    "experiment_leads",
    "public_comments",
    "permits",
    "meteorological_and_tidal_data",
    "data_conflicts_and_unreported_data",
    "additional_details",
    "*"
  ],

  // --- Base experiment fields ---

  experiment_id: {
    ...halfWidthStyle,
    "ui:widget": "LockableIdWidget",
    "ui:placeholder": "e.g., PROJECT-01-BASELINE-01",
    "ui:descriptionModal": true,
    "ui:options": {
      lockOnBlur: true
    }
  },
  name: {
    ...halfWidthStyle,
    "ui:title": "Experiment Name",
    "ui:placeholder": "e.g., Baseline Water Chemistry Study"
  },
  experiment_types: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget"
  },
  description: textAreaWidget,
  start_datetime: {
    ...halfWidthStyle,
    "ui:widget": "DateTimeWidget",
    "ui:description": "Start date and time of experiment in UTC"
  },
  end_datetime: {
    ...halfWidthStyle,
    "ui:widget": "DateTimeWidget",
    "ui:description": "End date and time of experiment in UTC"
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
    "ui:order": [
      "min_depth_in_m",
      "max_depth_in_m",
      "min_height_in_m",
      "max_height_in_m"
    ]
  },
  experiment_leads: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Person"
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
  public_comments: {
    "ui:placeholder":
      "Filename(s) of public comments provided, separated by a comma"
  },
  permits: {
    "ui:title": "Permits (if applicable)",
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
  },

  // --- Intervention fields (InterventionDetails mixin) ---

  alkalinity_feedstock: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.FeedstockType
    }
  },
  alkalinity_feedstock_custom: {
    ...halfWidthStyle,
    "ui:placeholder": "Specify other alkalinity feedstock type"
  },
  alkalinity_feedstock_form: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.AlkalinityFeedstockForm
    }
  },
  alkalinity_feedstock_processing: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:descriptionModal": true,
    "ui:options": {
      enumNames: enumNames.AlkalinityFeedstockProcessing
    }
  },
  alkalinity_feedstock_processing_custom: {
    ...halfWidthStyle,
    "ui:placeholder": "Specify custom processing method"
  },
  alkalinity_feedstock_description: textAreaWidget,
  alkalinity_feedstock_co2_removal_potential: {
    ...halfWidthStyle,
    "ui:placeholder": "kg CO\u2082 per tonne of feedstock"
  },
  equilibration: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.EquilibrationStatus
    }
  },
  alkalinity_dosing_effluent_density: {
    ...halfWidthStyle,
    "ui:field": "DosingConcentrationField"
  },

  // --- Tracer fields (TracerDetails mixin) ---

  tracer_form: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.TracerForm
    }
  },
  tracer_form_custom: {
    ...halfWidthStyle,
    "ui:placeholder": "Specify other tracer form"
  },
  tracer_details: {
    ...halfWidthStyle
  },
  tracer_concentration: {
    ...halfWidthStyle,
    "ui:field": "DosingConcentrationField"
  },

  // --- Shared dosing fields (DosingDetails mixin) ---

  dosing_location: {
    "ui:field": "DosingLocationField"
  },
  dosing_dispersal_hydrologic_location: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.HydrologicLocation
    }
  },
  dosing_delivery_type: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.DosingDeliveryType
    }
  },
  dosing_depth: {
    ...halfWidthStyle,
    "ui:widget": "DosingDepthWidget"
  },
  dosing_description: textAreaWidget,
  dosing_regimen: textAreaWidget
};

export default fieldExperimentUiSchema;
