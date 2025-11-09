// tracerUiSchema.ts - UI configuration for tracer experiments
// Inherits from experimentUiSchema and adds tracer-specific customizations

import experimentUiSchema from "./experimentUiSchema";
import schema from "../../../public/schema.bundled.json";
import { generateEnumNames } from "@/utils/enumDecorator";

// Generate formatted enum names for tracer-specific enums
const enumNames = generateEnumNames(schema, [
  "TracerForm",
  "HydrologicLocation",
  "DosingDeliveryType"
]);

const textAreaWidget = {
  "ui:widget": "textarea",
  "ui:options": { rows: 5 }
};

const halfWidthStyle = {
  "ui:style": {
    width: "50%"
  }
};

// Create tracer uiSchema by inheriting from experiment uiSchema
const tracerUiSchema = {
  // Inherit all base experiment uiSchema properties
  ...experimentUiSchema,

  // Override ui:order to include tracer-specific fields
  "ui:order": [
    "name",
    "experiment_id",
    "experiment_type",
    "description",
    "start_datetime",
    "end_datetime",
    "spatial_coverage",
    "vertical_coverage",
    // Tracer-specific fields
    "tracer_form",
    "tracer_form_custom",
    "tracer_details",
    "tracer_concentration",
    "dosing_location",
    "dosing_dispersal_hydrologic_location",
    "dosing_delivery_type",
    "dosing_depth",
    "dosing_description",
    "dosing_regimen",
    // Common fields
    "investigators",
    "meteorological_and_tidal_data",
    "data_conflicts_and_unreported_data",
    "additional_details",
    "*"
  ],

  // Tracer-specific field customizations
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

export default tracerUiSchema;
