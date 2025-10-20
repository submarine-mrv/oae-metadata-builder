import React from "react";
import { DateTimePicker } from "@mantine/dates";
import type { WidgetProps } from "@rjsf/utils";

/**
 * Custom widget for datetime fields using Mantine's DateTimePicker
 * Handles ISO 8601 datetime strings (e.g., "2024-01-15T14:30:00")
 */
const DateTimeWidget: React.FC<WidgetProps> = ({
  id,
  value,
  onChange,
  required,
  disabled,
  readonly,
  label,
  placeholder,
  schema
}) => {
  return (
    <DateTimePicker
      id={id}
      label={label}
      value={value ? new Date(value) : null}
      onChange={(dateStr) => {
        // DateTimePicker onChange returns string | null
        // Convert to ISO format or undefined for RJSF
        if (!dateStr) {
          onChange(undefined);
          return;
        }

        // Parse the string to Date to ensure it's valid, then convert to ISO
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          onChange(undefined);
          return;
        }

        onChange(date.toISOString());
      }}
      placeholder={placeholder || "Pick date and time"}
      required={required}
      disabled={disabled || readonly}
      clearable
      valueFormat="YYYY-MM-DD HH:mm:ss"
      withSeconds
      description={schema.description}
    />
  );
};

export default DateTimeWidget;
