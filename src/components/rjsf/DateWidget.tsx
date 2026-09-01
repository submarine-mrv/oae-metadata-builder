import { DateInput } from "@mantine/dates";
import type { WidgetProps } from "@rjsf/utils";
import { ariaDescribedByIds, labelValue } from "@rjsf/utils";
import dayjs from "dayjs";
import type React from "react";
import { useCallback } from "react";
import FieldLabel from "./FieldLabel";

const DATE_FORMAT = "YYYY-MM-DD";

const strictDateParser = (input: string): string | null => {
  const d = dayjs(input.trim(), DATE_FORMAT, true);
  return d.isValid() ? d.format(DATE_FORMAT) : null;
};

/**
 * DateWidget - Mantine DateInput for `format: date` fields.
 *
 * Replaces @rjsf/mantine's default for two reasons:
 * - Clearing that widget emits "" rather than dropping the value, and "" fails
 *   the schema's date format. For an optional field that leaves a dataset
 *   invalid after the user has just removed the offending value.
 * - It renders no description. Ours goes through FieldLabel like the other
 *   custom widgets, so `ui:descriptionModal` works here too.
 *
 * `weekendDays` comes from the theme so every DateInput agrees. `clearable` is
 * set here as well as there: Mantine only lets typed-out text deselect the
 * value when the input is clearable, and this widget exists to make that work.
 */
const DateWidget: React.FC<WidgetProps> = ({
  id,
  value,
  required,
  disabled,
  readonly,
  autofocus,
  label,
  hideLabel,
  placeholder,
  schema,
  uiSchema,
  rawErrors,
  onChange,
  onBlur,
  onFocus,
}) => {
  const parsed = typeof value === "string" && value ? dayjs(value, DATE_FORMAT, true) : null;
  const dateValue = parsed?.isValid() ? parsed.toDate() : null;

  const handleChange = useCallback(
    (next: Date | string | null) => {
      if (!next) {
        onChange(undefined);
        return;
      }
      // Strict: a typed 2027-02-30 must be refused, not rolled into March.
      const d = typeof next === "string" ? dayjs(next, DATE_FORMAT, true) : dayjs(next);
      onChange(d.isValid() ? d.format(DATE_FORMAT) : undefined);
    },
    [onChange],
  );

  const labelText = labelValue(label || undefined, hideLabel, false);
  const useModal = uiSchema?.["ui:descriptionModal"] === true;

  return (
    <div>
      {labelText && (
        <FieldLabel
          label={String(labelText)}
          description={schema?.description}
          required={required}
          useModal={useModal}
          // Match a native Mantine input label: md line height plus its 3px
          // bottom margin, so this control lines up with text inputs beside it.
          mb={3}
          lh="md"
        />
      )}
      <DateInput
        id={id}
        name={id}
        value={dateValue}
        valueFormat={DATE_FORMAT}
        // Mantine's default parser is lenient; only real calendar dates pass.
        dateParser={strictDateParser}
        clearable
        placeholder={placeholder || DATE_FORMAT}
        disabled={disabled || readonly}
        autoFocus={autofocus}
        onChange={handleChange}
        onBlur={() => onBlur?.(id, value)}
        onFocus={() => onFocus?.(id, value)}
        error={rawErrors && rawErrors.length > 0 ? rawErrors.join("\n") : undefined}
        aria-describedby={ariaDescribedByIds(id)}
        popoverProps={{ withinPortal: false }}
      />
    </div>
  );
};

export default DateWidget;
