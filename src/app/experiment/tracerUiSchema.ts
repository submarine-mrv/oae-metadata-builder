// tracerUiSchema.ts - UI configuration for tracer experiments
// Inherits from experimentUiSchema and adds tracer-specific customizations

import experimentUiSchema from "./experimentUiSchema";

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
    "experiment_id",
    "name",
    "experiment_type",
    "description",
    "start_datetime",
    "end_datetime",
    "spatial_coverage",
    "vertical_coverage",
    // Tracer-specific fields
    "tracer_form",
    "tracer_form_custom",
    "tracer_concentration",
    "tracer_description",
    "dosing_location",
    "dosing_location_provided_as_file",
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
    "ui:widget": "CustomSelectWidget"
  },
  tracer_form_custom: {
    "ui:placeholder": "Specify other tracer form"
  },
  tracer_description: textAreaWidget,
  tracer_concentration: {
    ...halfWidthStyle,
    "ui:field": "PlaceholderField"
  },
  dosing_location: {
    ...halfWidthStyle,
    "ui:field": "PlaceholderField"
  },
  dosing_dispersal_hydrologic_location: {
    "ui:widget": "CustomSelectWidget"
  },
  dosing_delivery_type: {
    "ui:widget": "CustomSelectWidget"
  },
  dosing_description: textAreaWidget
};

export default tracerUiSchema;
