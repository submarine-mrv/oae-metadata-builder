// modelUiSchema.ts - UI configuration for model experiments
// Inherits from experimentUiSchema and adds model-specific customizations

import experimentUiSchema from "./experimentUiSchema";
import schema from "../../../public/schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";
import {
  textAreaWidget,
  nestedItemStyle,
  halfWidthStyle
} from "../uiSchemaConstants";
import GridObjectFieldTemplate from "@/components/rjsf/GridObjectFieldTemplate";

// Generate formatted enum names for model-specific enums
const enumNames = generateEnumNames(schema, ["GridType", "ModelComponentType"]);

// Reusable uiSchema for NamedLink array fields (name + url pairs)
// Same pattern as meteorological_and_tidal_data in experimentUiSchema
const namedLinkArray = (addItemText: string) => ({
  "ui:options": {
    addable: true,
    orderable: false,
    addItemText
  },
  items: {
    "ui:title": "",
    "ui:style": nestedItemStyle,
    "ui:options": {
      gridCols: 2
    },
    name: {
      "ui:placeholder": "Dataset or source name"
    },
    url: {
      "ui:placeholder": "URL or DOI (e.g. https://...)"
    }
  }
});

// Create model uiSchema by inheriting from experiment uiSchema
const modelUiSchema = {
  // Inherit all base experiment uiSchema properties
  ...experimentUiSchema,

  // Override ui:order to include model-specific fields
  "ui:order": [
    "name",
    "experiment_id",
    "experiment_type",
    "description",
    "start_datetime",
    "end_datetime",
    "spatial_coverage",
    // Model-specific fields
    "model_components",
    "grid_details",
    "input_details",
    "model_configuration",
    // Common fields
    "principal_investigators",
    "*"
  ],

  // Model-specific field customizations
  model_components: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Model Component"
    },
    items: {
      "ui:title": "",
      "ui:style": nestedItemStyle,
      "ui:order": [
        "name",
        "model_component_type",
        "model_component_type_custom",
        "version",
        "codebase",
        "description",
        "references"
      ],
      name: {
        ...halfWidthStyle,
        "ui:placeholder": "e.g., MOM6, COBALT"
      },
      model_component_type: {
        ...halfWidthStyle,
        "ui:widget": "CustomSelectWidget",
        "ui:options": {
          enumNames: enumNames.ModelComponentType
        }
      },
      model_component_type_custom: {
        ...halfWidthStyle,
        "ui:placeholder": "Specify other component type"
      },
      version: {
        ...halfWidthStyle,
        "ui:placeholder": "e.g., v2.1.0"
      },
      codebase: {
        "ui:placeholder": "URL to source code repository"
      },
      description: textAreaWidget,
      references: {
        "ui:field": "StringListField",
        "ui:title": "References",
        "ui:options": {
          placeholder: "DOI or URL (press Enter to add)"
        }
      }
    }
  },

  grid_details: {
    "ui:options": {
      addable: true,
      orderable: false,
      addItemText: "Add Grid"
    },
    items: {
      "ui:title": "",
      "ui:style": nestedItemStyle,
      "ui:options": {
        ObjectFieldTemplate: GridObjectFieldTemplate
      },
      "ui:order": [
        "grid_name",
        "grid_type",
        "grid_geometry",
        "arrangement",
        "n_x",
        "n_y",
        "vertical_coordinate_type",
        "n_z",
        "n_nodes",
        "region",
        "horizontal_resolution_range",
        "vertical_resolution_range",
        "spatial_coverage"
      ],
      grid_name: {
        "ui:span": 6,
        "ui:placeholder": "e.g., Global 1/12 degree"
      },
      grid_type: {
        "ui:span": 6,
        "ui:widget": "CustomSelectWidget",
        "ui:options": {
          enumNames: enumNames.GridType
        }
      },
      grid_geometry: {
        "ui:span": 6,
        "ui:placeholder": "e.g., tripolar, regular lat-lon"
      },
      arrangement: {
        "ui:span": 6,
        "ui:placeholder": "e.g., Arakawa B-grid"
      },
      n_x: {
        "ui:span": 3,
        "ui:placeholder": "X cells"
      },
      n_y: {
        "ui:span": 3,
        "ui:placeholder": "Y cells"
      },
      n_z: {
        "ui:span": 3,
        "ui:placeholder": "Z levels"
      },
      n_nodes: {
        "ui:span": 3,
        "ui:placeholder": "Nodes"
      },
      horizontal_resolution_range: {
        "ui:span": 6,
        "ui:placeholder": "e.g., 1/12° (~8 km)"
      },
      vertical_resolution_range: {
        "ui:span": 6,
        "ui:placeholder": "e.g., 1-200 m (75 levels)"
      },
      region: {
        "ui:span": 6,
        "ui:placeholder": "e.g., North Atlantic"
      },
      spatial_coverage: {
        "ui:span": 12,
        "ui:field": "SpatialCoverageMiniMap",
        "ui:title": "Grid Spatial Coverage"
      }
    }
  },

  input_details: {
    "ui:style": nestedItemStyle,
    "ui:order": [
      "initial_conditions",
      "boundary_conditions",
      "atmospheric_forcing",
      "tidal_forcing",
      "bathymetry",
      "river_sediment_flux_details",
      "processing_of_input_data",
      "processing_code"
    ],
    initial_conditions: namedLinkArray("Add Initial Condition Source"),
    boundary_conditions: namedLinkArray("Add Boundary Condition Source"),
    atmospheric_forcing: namedLinkArray("Add Atmospheric Forcing Source"),
    tidal_forcing: namedLinkArray("Add Tidal Forcing Source"),
    bathymetry: namedLinkArray("Add Bathymetry Source"),
    river_sediment_flux_details: namedLinkArray(
      "Add River/Sediment Flux Source"
    ),
    processing_code: namedLinkArray("Add Processing Code"),
    processing_of_input_data: textAreaWidget
  },

  model_configuration: {
    "ui:field": "StringListField",
    "ui:title": "Model Configuration",
    "ui:options": {
      placeholder: "URL to configuration file or docs (press Enter to add)"
    }
  },

  // Hide project_id (auto-populated)
  project_id: {
    "ui:widget": "hidden"
  }
};

export default modelUiSchema;
