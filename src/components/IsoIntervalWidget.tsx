/**
 * IsoIntervalWidget - Date interval input for ISO 8601 interval strings
 *
 * Supports two layouts:
 * - "horizontal" (default): Side-by-side date inputs using Mantine Group
 * - "vertical": Stacked date inputs using Mantine Stack
 *
 * The layout can be configured via uiSchema:
 * ```json
 * { "ui:options": { "layout": "vertical" } }
 * ```
 */
"use client";

import * as React from "react";
import { WidgetProps } from "@rjsf/utils";
import { TextInput, Text, Group, Stack } from "@mantine/core";
import DatePickerPopover from "./DatePickerPopover";
import { parseInterval, buildInterval, validateDate } from "@/utils/dateUtils";

type LayoutType = "horizontal" | "vertical";

// Layout can be specified via:
// 1. uiSchema: { "ui:options": { "layout": "vertical" } }
// 2. Direct prop override from IsoIntervalWidgetVertical wrapper
interface IsoIntervalWidgetProps extends WidgetProps {
  layoutOverride?: LayoutType;
}

const IsoIntervalWidget: React.FC<IsoIntervalWidgetProps> = ({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  onBlur,
  onFocus,
  label,
  uiSchema,
  layoutOverride
}) => {
  // Get layout from direct prop or uiSchema, default to horizontal
  const layout: LayoutType =
    layoutOverride ||
    (uiSchema?.["ui:options"] as any)?.layout ||
    "horizontal";

  const { start, end } = React.useMemo(
    () => parseInterval(value as any),
    [value]
  );
  const [startDate, setStartDate] = React.useState(start);
  const [endDate, setEndDate] = React.useState(end);
  const [startPickerOpen, setStartPickerOpen] = React.useState(false);
  const [endPickerOpen, setEndPickerOpen] = React.useState(false);
  const [startTouched, setStartTouched] = React.useState(false);
  const [endTouched, setEndTouched] = React.useState(false);

  React.useEffect(() => {
    setStartDate(start);
    setEndDate(end);
  }, [start, end]);

  const emit = (s: string, e: string) =>
    onChange(buildInterval(s, e) ?? undefined);

  // Label text varies slightly by layout
  const startLabel = layout === "vertical" ? "Start Date" : "Start date";
  const endLabel = layout === "vertical" ? "End Date" : "End date (optional)";

  const startInput = (
    <TextInput
      label={startLabel}
      value={startDate}
      onChange={(event) => {
        const newValue = event.currentTarget.value;
        setStartDate(newValue);
        emit(newValue, endDate);
      }}
      onBlur={() => {
        setStartTouched(true);
        onBlur?.(id, startDate);
      }}
      onFocus={() => onFocus?.(id, startDate)}
      disabled={disabled || readonly}
      placeholder="YYYY-MM-DD"
      required={required}
      error={
        startTouched && startDate && !validateDate(startDate)
          ? "Invalid date format"
          : undefined
      }
      rightSection={
        <DatePickerPopover
          opened={startPickerOpen}
          onChange={setStartPickerOpen}
          value={startDate}
          onDateChange={(formatted) => {
            setStartDate(formatted);
            emit(formatted, endDate);
          }}
          onTouched={() => setStartTouched(true)}
          disabled={disabled}
          readonly={readonly}
        />
      }
    />
  );

  const endInput = (
    <TextInput
      label={endLabel}
      value={endDate}
      onChange={(event) => {
        const newValue = event.currentTarget.value;
        setEndDate(newValue);
        emit(startDate, newValue);
      }}
      onBlur={() => {
        setEndTouched(true);
        onBlur?.(id, endDate);
      }}
      onFocus={() => onFocus?.(id, endDate)}
      disabled={disabled || readonly}
      placeholder={layout === "vertical" ? "YYYY-MM-DD (optional)" : "YYYY-MM-DD"}
      error={
        endTouched && endDate && !validateDate(endDate)
          ? "Invalid date format"
          : undefined
      }
      rightSection={
        <DatePickerPopover
          opened={endPickerOpen}
          onChange={setEndPickerOpen}
          value={endDate}
          onDateChange={(dateStr) => {
            setEndDate(dateStr);
            emit(startDate, dateStr);
          }}
          onTouched={() => setEndTouched(true)}
          disabled={disabled}
          readonly={readonly}
        />
      }
    />
  );

  // Wrapper component based on layout
  const Container = layout === "vertical" ? Stack : Group;
  const containerProps = layout === "vertical" ? { gap: "sm" } : { grow: true };

  return (
    <div id={id}>
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
        </Text>
      )}
      <Container {...containerProps}>
        {layout === "horizontal" ? (
          <>
            <div style={{ position: "relative" }}>{startInput}</div>
            <div style={{ position: "relative" }}>{endInput}</div>
          </>
        ) : (
          <>
            {startInput}
            {endInput}
          </>
        )}
      </Container>
    </div>
  );
};

export default IsoIntervalWidget;
