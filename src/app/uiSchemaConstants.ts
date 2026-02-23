// uiSchemaConstants.ts - Shared UI schema configuration constants
// These constants are used across multiple experiment form UI schemas
import "./uiSchemaConstants.css";

export const textAreaWidget = {
  "ui:widget": "textarea",
  "ui:options": { rows: 5 },
  "ui:descriptionModal": true
};

export const nestedItemStyle = {
  border: "1px solid var(--brand-twilight)",
  borderRadius: "5px",
  padding: "16px",
  margin: "8px 0",
  background: "var(--brand-sunlight-overlay-light)" // Slightly darker than Shell background
};

export const halfWidthStyle = {
  "ui:classNames": "field-half-width"
};

export const quarterWidthStyle = {
  "ui:style": { width: "25%" }
};
