// interventionUiSchema.ts - UI configuration for intervention experiments
// Inherits from experimentUiSchema and adds intervention-specific customizations

import experimentUiSchema from "./experimentUiSchema";
import schema from "../../../public/schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";
import {
  textAreaWidget,
  nestedItemStyle,
  halfWidthStyle
} from "../uiSchemaConstants";

// Generate formatted enum names for intervention-specific enums
const enumNames = generateEnumNames(schema, [
  "FeedstockType",
  "AlkalinityFeedstockForm",
  "AlkalinityFeedstockProcessing",
  "EquilibrationStatus",
  "HydrologicLocation",
  "DosingDeliveryType"
]);
// Create intervention uiSchema by inheriting from experiment uiSchema
const interventionUiSchema = {
  // Inherit all base experiment uiSchema properties
  ...experimentUiSchema,

  // Override ui:order to include intervention-specific fields
  "ui:order": [
    "name",
    "project_id",
    "experiment_id",
    "experiment_type",
    "description",
    "start_datetime",
    "end_datetime",
    "spatial_coverage",
    "vertical_coverage",
    // Intervention-specific fields
    "alkalinity_feedstock_processing",
    "alkalinity_feedstock_processing_custom",
    "alkalinity_feedstock_form",
    "alkalinity_feedstock",
    // alkalinity_feedstock_custom appears conditionally via if/then in schema
    "alkalinity_feedstock_custom",
    "alkalinity_feedstock_co2_removal_potential",
    "alkalinity_feedstock_description",
    "equilibration",
    "alkalinity_dosing_effluent_density",
    "dosing_location",
    // will be migrated to inside of dosing_location:
    // "dosing_location_provided_as_file",
    "dosing_dispersal_hydrologic_location",
    "dosing_delivery_type",
    "dosing_depth",
    "dosing_description",
    "dosing_regimen",
    // Common fields
    "principal_investigators",
    "meteorological_and_tidal_data",
    "data_conflicts_and_unreported_data",
    "additional_details",
    "*"
  ],

  // Intervention-specific field customizations
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
    "ui:placeholder": "kg CO₂ per tonne of feedstock"
  },
  equilibration: {
    ...halfWidthStyle,
    "ui:widget": "CustomSelectWidget",
    "ui:options": {
      enumNames: enumNames.EquilibrationStatus
    }
  },
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
  dosing_details: {
    // This is a conditional field (StaticDosingDetails vs VariableDosingDetails)
    // RJSF will handle the anyOf/oneOf automatically
    "ui:descriptionModal": true
  },
  dosing_depth: {
    ...halfWidthStyle,
    "ui:widget": "DosingDepthWidget"
  },
  dosing_description: textAreaWidget,
  dosing_regimen: textAreaWidget,
  alkalinity_dosing_effluent_density: {
    ...halfWidthStyle,
    "ui:field": "DosingConcentrationField"
  }
};

export default interventionUiSchema;
