/**
 * IsoIntervalWidget - Horizontal date interval input for ISO 8601 interval strings
 *
 * For vertical layout, use IsoIntervalWidgetVertical instead.
 */
"use client";

import * as React from "react";
import { WidgetProps } from "@rjsf/utils";
import { TextInput, Text, Group } from "@mantine/core";
import DatePickerPopover from "./DatePickerPopover";
import { useIsoInterval } from "@/hooks/useIsoInterval";

const IsoIntervalWidget: React.FC<WidgetProps> = ({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  onBlur,
  onFocus,
  label,
  options,
  rawErrors
}) => {
  // Surface RJSF-supplied errors on both date inputs. We display the
  // actual first message (which has been normalized by transformFormErrors
  // upstream — required errors become "Field is required", others retain
  // their specific text). Internal format errors take precedence so the
  // user sees the most specific message first.
  const externalError =
    rawErrors && rawErrors.length > 0 ? rawErrors[0] : undefined;
  // Check if end date is required via ui:options
  const endDateRequired = options?.endDateRequired === true;

  const interval = useIsoInterval({
    id,
    value: value as string | undefined,
    onChange,
    onBlur,
    onFocus,
    hasError: !!externalError
  });

  return (
    <div id={id}>
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
        </Text>
      )}
      <Group grow align="flex-start">
        <div style={{ position: "relative" }}>
          <TextInput
            label="Start date"
            value={interval.startDate}
            onChange={(event) => interval.handleStartChange(event.currentTarget.value)}
            onBlur={interval.handleStartBlur}
            onFocus={interval.handleStartFocus}
            disabled={disabled || readonly}
            placeholder="YYYY-MM-DD"
            required={required}
            error={interval.startError || externalError}
            rightSection={
              <DatePickerPopover
                opened={interval.startPickerOpen}
                onChange={interval.setStartPickerOpen}
                value={interval.startDate}
                onDateChange={interval.handleStartDatePick}
                onTouched={() => interval.setStartTouched(true)}
                disabled={disabled}
                readonly={readonly}
              />
            }
          />
        </div>
        <div style={{ position: "relative" }}>
          <TextInput
            label={endDateRequired ? "End date" : "End date (optional)"}
            value={interval.endDate}
            onChange={(event) => interval.handleEndChange(event.currentTarget.value)}
            onBlur={interval.handleEndBlur}
            onFocus={interval.handleEndFocus}
            disabled={disabled || readonly}
            placeholder="YYYY-MM-DD"
            required={endDateRequired}
            error={interval.endError || (endDateRequired ? externalError : undefined)}
            rightSection={
              <DatePickerPopover
                opened={interval.endPickerOpen}
                onChange={interval.setEndPickerOpen}
                value={interval.endDate}
                onDateChange={interval.handleEndDatePick}
                onTouched={() => interval.setEndTouched(true)}
                disabled={disabled}
                readonly={readonly}
              />
            }
          />
        </div>
      </Group>
    </div>
  );
};

export default IsoIntervalWidget;
