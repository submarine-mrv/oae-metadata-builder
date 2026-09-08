/**
 * IsoIntervalWidget - Two date inputs backed by one ISO 8601 interval string.
 *
 * Each half is a Mantine DateInput, the same control as the data access date:
 * clicking anywhere in the input opens the calendar, and text that does not
 * parse as a date is discarded on blur instead of stored and flagged. That is
 * why this widget no longer carries its own format validation.
 *
 * `ui:options.layout: "vertical"` stacks the inputs for narrow columns; the
 * default puts them side by side. `ui:options.endDateRequired` makes the end
 * date mandatory.
 */

import { Group, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { WidgetProps } from "@rjsf/utils";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type * as React from "react";
import { MESSAGES } from "@/constants/messages";
import { useIsoInterval } from "@/hooks/useIsoInterval";
import { parseInterval, validateDate } from "@/utils/dateUtils";

// Strict format parsing is a plugin. Without it dayjs ignores the format and
// rolls 2024-02-31 over to March; this widget must not rely on another module
// having registered it first.
dayjs.extend(customParseFormat);

const DATE_FORMAT = "YYYY-MM-DD";

/**
 * DateInput takes a YYYY-MM-DD string; anything else (a malformed half from an
 * imported file) is shown as empty rather than echoed back as text.
 */
const asDateString = (value: string): string | null =>
  value && dayjs(value, DATE_FORMAT, true).isValid() ? value : null;

/**
 * Mantine's default parser is lenient and would turn 2024-02-31 into a real
 * date. Strict parsing keeps the calendar-date check the old text inputs had.
 */
const strictDateParser = (input: string): string | null => {
  const d = dayjs(input.trim(), DATE_FORMAT, true);
  return d.isValid() ? d.format(DATE_FORMAT) : null;
};

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
  // Surface RJSF-supplied errors, already normalized by transformFormErrors.
  const externalError = rawErrors && rawErrors.length > 0 ? rawErrors[0] : undefined;
  const endDateRequired = options?.endDateRequired === true;
  const isVertical = options?.layout === "vertical";
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
    editable: !(disabled || readonly),
  });

  // A stored half that is not a real calendar date renders blank. While
  // editable the hook drops it at once; read-only it stays, so the input has
  // to say why it is empty rather than look valid.
  const stored = parseInterval(value as string | undefined);
  const startStoredInvalid = Boolean(stored.start) && !validateDate(stored.start);
  const endStoredInvalid = Boolean(stored.end) && !validateDate(stored.end);

  // Both dates live in one interval string, so a schema error on it arrives
  // without saying which half is wrong. Attribute it to a half that is missing
  // or malformed; anything else (an ordering rule, say) belongs to the interval
  // and goes on the start input.
  const endAtFault = endStoredInvalid || (endDateRequired && !interval.endDate);
  const startAtFault = startStoredInvalid || !interval.startDate;
  const startExternalError = startAtFault || !endAtFault ? externalError : undefined;
  const endExternalError = endAtFault ? externalError : undefined;
  const startError = startStoredInvalid
    ? MESSAGES.validation.invalidDateFormat
    : startExternalError;
  const endError = endStoredInvalid ? MESSAGES.validation.invalidDateFormat : endExternalError;

  const common = {
    valueFormat: DATE_FORMAT,
    dateParser: strictDateParser,
    placeholder: DATE_FORMAT,
    disabled: disabled || readonly,
    clearable: true,
    popoverProps: { withinPortal: true },
  };

  return (
    <div id={id}>
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
        </Text>
      )}
      <Layout {...layoutProps}>
        <DateInput
          {...common}
          id={`${id}_start`}
          label="Start date"
          value={asDateString(interval.startDate)}
          onChange={(next) => interval.setStart(next ?? "")}
          weekendDays={[]}
          onBlur={interval.handleStartBlur}
          onFocus={interval.handleStartFocus}
          required={required}
          error={startError}
        />
        <DateInput
          {...common}
          id={`${id}_end`}
          label={endDateRequired ? "End date" : "End date (optional)"}
          value={asDateString(interval.endDate)}
          onChange={(next) => interval.setEnd(next ?? "")}
          weekendDays={[]}
          onBlur={interval.handleEndBlur}
          onFocus={interval.handleEndFocus}
          required={endDateRequired}
          error={endError}
        />
      </Layout>
    </div>
  );
};

export default IsoIntervalWidget;
