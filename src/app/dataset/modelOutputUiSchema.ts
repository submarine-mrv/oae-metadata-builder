// modelOutputUiSchema.ts - UI configuration for model output datasets
// Tailored for ModelOutputDataset schema fields

import schema from "../../../public/schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";
import {
  textAreaWidget,
  nestedItemStyle,
  halfWidthStyle
} from "../uiSchemaConstants";

const enumNames = generateEnumNames(schema, ["DatasetType", "SimulationType", "ResearcherIDType"]);

const modelOutputUiSchema = {
  "ui:title": "",
  "ui:options": {
    expandable: false
  },
  "ui:order": [
    "name",
    "experiment_id",
    "description",
    "dataset_type",
    "simulation_type",
    "mcdr_forcing_description",
    "start_datetime",
    "end_datetime",
    "model_output_variables",
    "output_frequency",
    "time_stepping_scheme",
    "spin_up_protocol",
    "hardware_configuration",
    "filenames",
    "data_submitter",
    "author_list_for_citation",
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
  project_id: {
    "ui:widget": "hidden"
  },
  experiment_id: {
    ...halfWidthStyle,
    "ui:widget": "LinkedExperimentIdWidget",
    "ui:title": "Experiment",
    "ui:descriptionModal": true
  },
  dataset_type: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:enumNames": enumNames.DatasetType
  },
  dataset_type_custom: {
    "ui:widget": "hidden"
  },
  simulation_type: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.SimulationType
    }
  },
  mcdr_forcing_description: textAreaWidget,
  start_datetime: {
    ...halfWidthStyle,
    "ui:widget": "DateTimeWidget",
    "ui:title": "Simulation Start",
    "ui:description": "Start date and time of simulation in UTC"
  },
  end_datetime: {
    ...halfWidthStyle,
    "ui:widget": "DateTimeWidget",
    "ui:title": "Simulation End",
    "ui:description": "End date and time of simulation in UTC"
  },
  model_output_variables: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      placeholder: "Search output variables…"
    }
  },
  output_frequency: {
    ...halfWidthStyle,
    "ui:placeholder": "e.g., daily, monthly, hourly"
  },
  time_stepping_scheme: {
    ...halfWidthStyle,
    "ui:placeholder": "e.g., leapfrog, Runge-Kutta"
  },
  spin_up_protocol: textAreaWidget,
  hardware_configuration: {
    "ui:style": nestedItemStyle,
    "ui:order": [
      "machine",
      "cpu_gpu_details",
      "parallelization",
      "memory",
      "storage",
      "operating_system"
    ],
    machine: {
      "ui:placeholder": "e.g., NOAA Gaea, NCAR Cheyenne"
    },
    cpu_gpu_details: {
      "ui:placeholder": "e.g., 2x Intel Xeon, 128 cores"
    },
    parallelization: {
      "ui:placeholder": "e.g., MPI with 256 ranks"
    },
    memory: {
      "ui:placeholder": "e.g., 512 GB"
    },
    storage: {
      "ui:placeholder": "e.g., 10 TB output"
    },
    operating_system: {
      "ui:placeholder": "e.g., CentOS 7"
    }
  },
  filenames: {
    "ui:field": "FilenamesField",
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
      "ui:widget": "CustomSelectWidget",
      "ui:enumNames": enumNames.ResearcherIDType
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
  license: {
    ...textAreaWidget,
    "ui:placeholder": "License terms for data usage (e.g., CC BY 4.0)"
  },
  fair_use_data_request: {
    ...textAreaWidget,
    "ui:placeholder": "Statement regarding how this dataset should be used"
  }
};

export default modelOutputUiSchema;
