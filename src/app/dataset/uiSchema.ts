// uiSchema.ts - Dataset form UI schema configuration

import schema from "../../../public/schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";
import {
  textAreaWidget,
  nestedItemStyle,
  halfWidthStyle
} from "../uiSchemaConstants";

const enumNames = generateEnumNames(schema, ["DatasetType", "DataProductType"]);

// UI schema configuration for dataset form
const datasetUiSchema = {
  "ui:title": "",
  "ui:options": {
    expandable: false
  },
  "ui:order": [
    "name",
    "description",
    "temporal_coverage",
    "dataset_type",
    "data_product_type",
    "filenames",
    "platform_info",
    "data_submitter",
    "author_list_for_citation",
    "qc_flag_scheme",
    "calibration_files",
    "license",
    "fair_use_data_request",
    "*"
  ],
  name: {
    "ui:placeholder":
      "Brief descriptive sentence summarizing the dataset content",
    "ui:descriptionModal": true
  },
  description: textAreaWidget,
  // Hide project_id and experiment_id - will be auto-connected later
  project_id: {
    "ui:widget": "hidden"
  },
  experiment_id: {
    "ui:widget": "hidden"
  },
  temporal_coverage: {
    "ui:widget": "IsoIntervalWidget",
    "ui:title": "",
    "ui:style": { width: "50%" },
    "ui:options": {
      endDateRequired: true
    }
  },
  dataset_type: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:enumNames": enumNames.DatasetType
  },
  // Hide dataset_type_custom - should render conditionally later
  dataset_type_custom: {
    "ui:widget": "hidden"
  },
  data_product_type: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:enumNames": enumNames.DataProductType
  },
  filenames: {
    "ui:field": "FilenamesField"
  },
  platform_info: {
    "ui:style": nestedItemStyle,
    "ui:order": ["name", "platform_type", "platform_id", "owner", "country"],
    name: {
      "ui:placeholder": "e.g., R/V Wecoma"
    },
    platform_type: {
      "ui:widget": "CustomSelectWidget"
    },
    platform_id: {
      "ui:placeholder": "Unique identifier for the platform"
    },
    owner: {
      "ui:placeholder": "Institution that owns the platform"
    },
    country: {
      "ui:placeholder": "e.g., US"
    }
  },
  data_submitter: {
    "ui:style": nestedItemStyle,
    "ui:order": [
      "name",
      "email",
      "phone",
      "identifier",
      "identifier_type",
      "role",
      "affiliation"
    ],
    name: {
      "ui:placeholder": "Full name of the data submitter"
    },
    email: {
      "ui:placeholder": "email@example.com"
    },
    phone: {
      "ui:placeholder": "+1-555-555-5555"
    },
    identifier: {
      "ui:placeholder": "https://orcid.org/0000-0000-0000-0000"
    },
    identifier_type: {
      "ui:widget": "CustomSelectWidget"
    },
    role: {
      "ui:placeholder": "e.g., Data Submitter, Principal Investigator"
    },
    affiliation: {
      "ui:title": "Affiliation",
      "ui:order": ["name", "identifier", "country"],
      name: {
        "ui:title": "Organization Name",
        "ui:placeholder": "Institution or organization"
      },
      identifier: {
        "ui:title": "Organization ROR",
        "ui:placeholder": "https://ror.org/..."
      },
      country: {
        "ui:placeholder": "e.g., US"
      }
    }
  },
  author_list_for_citation: {
    "ui:widget": "textarea",
    "ui:options": { rows: 2 },
    "ui:placeholder": "Lastname1, Firstname1; Lastname2, Firstname2; ...",
    "ui:descriptionModal": true
  },
  qc_flag_scheme: {
    ...textAreaWidget,
    "ui:placeholder": "Describe what quality control flags stand for..."
  },
  calibration_files: {
    "ui:field": "FilenamesField"
  },
  license: {
    ...textAreaWidget,
    "ui:placeholder": "License terms for data usage (e.g., CC BY 4.0)"
  },
  fair_use_data_request: {
    ...textAreaWidget,
    "ui:placeholder": "Statement regarding how this dataset should be used"
  },
  // Hide variables field - we'll manage it separately with a custom component
  variables: {
    "ui:widget": "hidden"
  }
};

export default datasetUiSchema;
