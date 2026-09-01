/**
 * IsoIntervalWidgetVertical - Vertical date interval input for ISO 8601 interval strings
 *
 * Used in ExternalProjectField for stacked layout.
 * For horizontal layout, use IsoIntervalWidget instead.
 */

import { Stack, Text, TextInput } from "@mantine/core";
import type { WidgetProps } from "@rjsf/utils";
import type * as React from "react";
import { useIsoInterval } from "@/hooks/useIsoInterval";
import DatePickerPopover from "./DatePickerPopover";

const IsoIntervalWidgetVertical: React.FC<WidgetProps> = ({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  onBlur,
  onFocus,
  label,
  rawErrors,
}) => {
  // Surface RJSF-supplied errors on the start input, matching IsoIntervalWidget.
  // Internal format errors take precedence so the most specific message wins.
  // End date is optional here, so only the start input carries the external error.
  const externalError = rawErrors && rawErrors.length > 0 ? rawErrors[0] : undefined;

  const interval = useIsoInterval({
    id,
    value: value as string | undefined,
    onChange,
    onBlur,
    onFocus,
    hasError: !!externalError,
  });

  return (
    <div id={id}>
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
        </Text>
      )}
      <Stack gap="sm">
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
        <TextInput
          label="End date (optional)"
          value={interval.endDate}
          onChange={(event) => interval.handleEndChange(event.currentTarget.value)}
          onBlur={interval.handleEndBlur}
          onFocus={interval.handleEndFocus}
          disabled={disabled || readonly}
          placeholder="YYYY-MM-DD"
          error={interval.endError}
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
      </Stack>
    </div>
  );
};

export default IsoIntervalWidgetVertical;
