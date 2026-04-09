// uiSchemaConstants.ts - Shared UI schema configuration constants
// These constants are used across multiple experiment form UI schemas
// CSS for field-half-width is in uiSchemaConstants.css, imported via layout.tsx

export const textAreaWidget = {
  "ui:widget": "textarea",
  "ui:options": { rows: 5 },
  "ui:descriptionModal": true
};

// Border parts are exported individually so other components (e.g. the
// CustomFieldTemplate that turns this border red on validation errors)
// can recreate the same shorthand without drifting if width/style change.
export const NESTED_ITEM_BORDER_WIDTH = "1px";
export const NESTED_ITEM_BORDER_STYLE = "solid";

export const nestedItemStyle = {
  border: `${NESTED_ITEM_BORDER_WIDTH} ${NESTED_ITEM_BORDER_STYLE} var(--brand-twilight)`,
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
