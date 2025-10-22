// interventionUiSchema.ts - UI configuration for intervention experiments
// Inherits from experimentUiSchema and adds intervention-specific customizations

import experimentUiSchema from "./experimentUiSchema";

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

// Create intervention uiSchema by inheriting from experiment uiSchema
const interventionUiSchema = {
  // Inherit all base experiment uiSchema properties
  ...experimentUiSchema,

  // Override ui:order to include intervention-specific fields
  "ui:order": [
    "experiment_id",
    "name",
    "experiment_type",
    "description",
    "start_datetime",
    "end_datetime",
    "spatial_coverage",
    "vertical_coverage",
    // Intervention-specific fields
    "alkalinity_feedstock",
    "alkalinity_feedstock_other",
    "alkalinity_feedstock_form",
    "alkalinity_feedstock_processing",
    "alkalinity_feedstock_processing_other",
    "alkalinity_feedstock_description",
    "alkalinity_feedstock_co2_removal_potential",
    "equilibration",
    "dosing_location",
    "dosing_dispersal_hydrologic_location",
    "dosing_delivery_type",
    "dosing_details",
    "dosing_description",
    "dosing_regimen",
    "alkalinity_dosing_effluent_density",
    // Common fields
    "investigators",
    "meteorological_and_tidal_data",
    "data_conflicts_and_unreported_data",
    "additional_details",
    "*"
  ],

  // Intervention-specific field customizations
  alkalinity_feedstock: {
    "ui:style": { width: "50%" },
    "ui:widget": "CustomSelectWidget"
  },
  alkalinity_feedstock_other: {
    "ui:placeholder": "Specify other alkalinity feedstock type"
  },
  alkalinity_feedstock_form: {
    "ui:style": { width: "50%" },
    "ui:widget": "CustomSelectWidget"
  },
  alkalinity_feedstock_processing: {
    "ui:widget": "CustomSelectWidget",
    "ui:descriptionModal": true
  },
  alkalinity_feedstock_processing_other: {
    "ui:placeholder": "Specify other processing method"
  },
  alkalinity_feedstock_description: textAreaWidget,
  alkalinity_feedstock_co2_removal_potential: {
    "ui:style": { width: "50%" },
    "ui:placeholder": "kg CO₂ per tonne of feedstock"
  },
  equilibration: {
    "ui:style": { width: "50%" },
    "ui:widget": "CustomSelectWidget"
  },
  dosing_location: {
    "ui:options": {
      gridCols: 2
    },
    "ui:order": ["latitude", "longitude"],
    latitude: {
      "ui:placeholder": "Decimal degrees"
    },
    longitude: {
      "ui:placeholder": "Decimal degrees"
    }
  },
  dosing_dispersal_hydrologic_location: {
    "ui:style": { width: "50%" },
    "ui:widget": "CustomSelectWidget"
  },
  dosing_delivery_type: {
    "ui:style": { width: "50%" },
    "ui:widget": "CustomSelectWidget"
  },
  dosing_details: {
    // This is a conditional field (StaticDosingDetails vs VariableDosingDetails)
    // RJSF will handle the anyOf/oneOf automatically
    "ui:descriptionModal": true
  },
  dosing_description: textAreaWidget,
  dosing_regimen: textAreaWidget,
  alkalinity_dosing_effluent_density: {
    "ui:placeholder": "e.g., 1.05 g/cm³ (measured) or provide link to data"
  }
};

export default interventionUiSchema;