"use client";
import * as React from "react";
import { WidgetProps } from "@rjsf/utils";
import { TextInput, Box } from "@mantine/core";
import { FieldLabelSmall } from "./FieldLabel";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import DateTimePickerPopoverV2 from "../DateTimePickerPopoverV2";

dayjs.extend(customParseFormat);
dayjs.extend(utc);

// Format constants
const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const DATE_FORMAT = "YYYY-MM-DD";

/**
 * DateTimeWidgetV2 - Simplified datetime widget
 *
 * All times are UTC - no timezone conversions.
 *
 * Features:
 * - Direct text input in YYYY-MM-DD HH:mm:ss format
 * - Calendar/time picker popover
 * - Auto-completion: YYYY-MM-DD → YYYY-MM-DD 00:00:00 on blur
 * - Validation blocks form submission if invalid
 */

// Convert ISO string to display format
const parseFromIso = (isoStr?: string): string => {
  if (!isoStr) return "";
  const d = dayjs.utc(isoStr);
  return d.isValid() ? d.format(DATETIME_FORMAT) : "";
};

// Convert display format to ISO string
const parseToIso = (dateStr: string): string | undefined => {
  if (!dateStr) return undefined;

  // Try full datetime format
  let d = dayjs.utc(dateStr, DATETIME_FORMAT, true);
  if (d.isValid()) return d.toISOString();

  // Try date-only format (auto-complete with 00:00:00)
  d = dayjs.utc(dateStr, DATE_FORMAT, true);
  if (d.isValid()) return d.hour(0).minute(0).second(0).toISOString();

  return undefined;
};

// Validate datetime string format
const validateDateTime = (input: string): boolean => {
  if (!input) return true;

  // Accept full datetime format
  let d = dayjs.utc(input, DATETIME_FORMAT, true);
  if (d.isValid()) return true;

  // Accept date-only format
  d = dayjs.utc(input, DATE_FORMAT, true);
  return d.isValid();
};

const DateTimeWidgetV2: React.FC<WidgetProps> = ({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  onBlur,
  onFocus,
  label,
  placeholder,
  schema,
  uiSchema
}) => {
  const [dateTime, setDateTime] = React.useState(parseFromIso(value as string));
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true;

  // Sync with external value changes
  React.useEffect(() => {
    setDateTime(parseFromIso(value as string));
  }, [value]);

  const handleChange = (newValue: string) => {
    setDateTime(newValue);
  };

  const handleBlur = () => {
    setTouched(true);

    // Auto-complete date-only entries with 00:00:00
    let finalValue = dateTime;
    if (dateTime) {
      const fullDateTime = dayjs.utc(dateTime, DATETIME_FORMAT, true);
      const dateOnly = dayjs.utc(dateTime, DATE_FORMAT, true);

      if (!fullDateTime.isValid() && dateOnly.isValid()) {
        finalValue = dateOnly.format(DATE_FORMAT) + " 00:00:00";
        setDateTime(finalValue);
      }
    }

    // Parse and propagate - undefined blocks form submission if invalid
    const isoValue = parseToIso(finalValue);
    onChange(isoValue);
    onBlur && onBlur(id, finalValue);
  };

  const handlePickerChange = (newValue: string) => {
    setDateTime(newValue);
    setTouched(true);

    // Propagate immediately when using picker
    const isoValue = parseToIso(newValue);
    onChange(isoValue);
  };

  return (
    <Box>
      <FieldLabelSmall
        label={label}
        description={description}
        useModal={useModal}
        required={required}
      />
      <TextInput
        id={id}
        value={dateTime}
        onChange={(event) => handleChange(event.currentTarget.value)}
        onBlur={handleBlur}
        onFocus={() => onFocus && onFocus(id, dateTime)}
        disabled={disabled || readonly}
        placeholder={placeholder || DATETIME_FORMAT}
        required={required}
        error={
          touched && dateTime && !validateDateTime(dateTime)
            ? `Invalid datetime format (use ${DATETIME_FORMAT})`
            : undefined
        }
        rightSection={
          <DateTimePickerPopoverV2
            opened={pickerOpen}
            onChange={setPickerOpen}
            value={dateTime}
            onDateTimeChange={handlePickerChange}
            disabled={disabled}
            readonly={readonly}
          />
        }
      />
    </Box>
  );
};

export default DateTimeWidgetV2;
