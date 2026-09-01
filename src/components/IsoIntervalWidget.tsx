/**
 * IsoIntervalWidget - Two date inputs backed by one ISO 8601 interval string.
 *
 * `ui:options.layout: "vertical"` stacks the inputs for narrow columns; the
 * default puts them side by side. Both share the same value contract, so the
 * layout is the only difference.
 */

import { Group, Stack, Text, TextInput } from "@mantine/core";
import type { WidgetProps } from "@rjsf/utils";
import type * as React from "react";
import { useIsoInterval } from "@/hooks/useIsoInterval";
import { validateDate } from "@/utils/dateUtils";
import DatePickerPopover from "./DatePickerPopover";

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
  rawErrors,
}) => {
  // Surface RJSF-supplied errors on both date inputs. We display the
  // actual first message (which has been normalized by transformFormErrors
  // upstream — required errors become "Field is required", others retain
  // their specific text). Internal format errors take precedence so the
  // user sees the most specific message first.
  const externalError = rawErrors && rawErrors.length > 0 ? rawErrors[0] : undefined;
  // Check if end date is required via ui:options
  const endDateRequired = options?.endDateRequired === true;
  const isVertical = options?.layout === "vertical";
  // Stacked inputs are already full width; side-by-side ones need `grow` to
  // split the row evenly.
  const Layout = isVertical ? Stack : Group;
  const layoutProps = isVertical
    ? { gap: "sm" as const }
    : { grow: true, align: "flex-start" as const };

  const interval = useIsoInterval({
    id,
    value: value as string | undefined,
    onChange,
    onBlur,
    onFocus,
    hasError: !!externalError,
  });

  // Both dates live in one interval string, so a schema error on it arrives
  // without saying which half is wrong. Attribute it to whichever input is
  // actually malformed, or a valid start date gets marked for the end date's
  // mistake. When neither is malformed (an ordering rule, say) it falls to the
  // start input.
  const startMalformed = !interval.startDate || !validateDate(interval.startDate);
  const endMalformed = Boolean(interval.endDate) && !validateDate(interval.endDate);
  const startExternalError = startMalformed || !endMalformed ? externalError : undefined;
  const endExternalError = endMalformed || endDateRequired ? externalError : undefined;

  return (
    <div id={id}>
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
        </Text>
      )}
      <Layout {...layoutProps}>
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
            error={interval.startError || startExternalError}
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
            error={interval.endError || endExternalError}
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
      </Layout>
    </div>
  );
};

export default IsoIntervalWidget;
