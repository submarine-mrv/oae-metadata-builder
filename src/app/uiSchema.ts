// uiSchema.ts

// Generate formatted enum names from schema
import schema from "../../public/schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";
import { textAreaWidget, nestedItemStyle } from "./experiment/uiSchemaConstants";

const enumNames = generateEnumNames(schema, ["MCDRPathway"]);

// UI schema configuration for project form
const projectUiSchema = {
  "ui:title": "",
  "ui:options": {
    expandable: false
  },
  "ui:order": [
    "research_project",
    "project_id",
    "project_description",
    "mcdr_pathway",
    "sea_names",
    "spatial_coverage",
    "temporal_coverage",
    "physical_site_description",
    "social_context_site_description",
    "social_research_conducted_to_date",
    "colocated_operations",
    "previous_or_ongoing_colocated_research",
    "public_comments",
    "permits",
    "funding",
    "additional_details",
    "*"
  ],
  project_id: {
    "ui:style": { width: "50%" },
    "ui:placeholder": "Enter project ID",
    "ui:descriptionModal": true
  },
  temporal_coverage: {
    "ui:widget": "IsoIntervalWidget",
    "ui:title": "",
    "ui:style": { width: "50%" }
  },
  spatial_coverage: {
    "ui:field": "SpatialCoverageMiniMap",
    "ui:title": "Spatial Coverage"
  },
  mcdr_pathway: {
    "ui:style": { width: "50%" },
    "ui:widget": "CustomSelectWidget",
    "ui:enumNames": enumNames.MCDRPathway
  },
  public_comments: {
    "ui:placeholder":
      "filename(s) of public comments provided, separated by a comma"
  },
  sea_names: {
    "ui:style": { width: "50%" },
    "ui:widget": "CustomSelectWidget"
  },
  project_description: textAreaWidget,
  physical_site_description: textAreaWidget,
  social_context_site_description: textAreaWidget,
  social_research_conducted_to_date: textAreaWidget,
  previous_or_ongoing_colocated_research: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Co-located Research"
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
  research_project: {
    "ui:title": "Research Project",
    "ui:style": { width: "50%" }
  },
  funding: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Funding Source"
    },
    items: {
      "ui:title": "",
      "ui:style": nestedItemStyle,
      "ui:order": ["name", "identifier", "start_date", "end_date", "funder"],
      "ui:options": {
        gridCols: 2
      },
      name: {
        "ui:title": "Grant or Project Name",
        "ui:placeholder": "e.g., NSF Ocean Sciences Research Grant"
      },
      identifier: {
        "ui:title": "Grant or Project Identifier",
        "ui:placeholder": "e.g., Grant number or URL"
      },
      funder: {
        "ui:style": { gridColumn: "1 / -1" },
        "ui:title": "",
        "ui:order": ["name", "identifier", "country"],
        name: {
          "ui:title": "Name of Funding Organization",
          "ui:placeholder": "Organization name"
        },
        country: {
          "ui:placeholder": "e.g., US"
        },
        identifier: {
          "ui:title": "Identifier for Funding Organization",
          "ui:descriptionModal": true,
          "ui:placeholder": "e.g., ROR URL (https://ror.org/...)"
        }
      }
    }
  },
  additional_details: textAreaWidget,
  experiments: {
    "ui:widget": "hidden"
  }
};

export default projectUiSchema;
