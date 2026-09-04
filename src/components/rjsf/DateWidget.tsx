import { CloseButton, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { WidgetProps } from "@rjsf/utils";
import { ariaDescribedByIds, labelValue } from "@rjsf/utils";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type React from "react";
import { useCallback, useEffect } from "react";
import FieldLabel from "./FieldLabel";

// Strict format parsing is a plugin. Without it dayjs ignores the format and
// rolls 2027-02-30 over to March, which is exactly what this widget must refuse.
dayjs.extend(customParseFormat);

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
  // An imported value the strict parser rejects. DateInput would show it as
  // empty with no clear control, leaving an invisible value that keeps failing
  // validation, so it is shown as text until it is corrected or removed.
  const storedInvalid = parsed !== null && !parsed.isValid();

  // An imported "" looks cleared but still fails `format: date`, and the picker
  // offers nothing to clear. Drop it, the same as a user clearing the field.
  useEffect(() => {
    if (value === "") onChange(undefined);
  }, [value, onChange]);

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

  const fieldLabel = labelText && (
    <FieldLabel
      label={String(labelText)}
      description={schema?.description}
      required={required}
      useModal={useModal}
      // Match a native Mantine input label: md line height plus its 3px
      // bottom margin, so this control lines up with text inputs beside it.
      mb={3}
      lh="md"
      labelId={`${id}-label`}
    />
  );

  if (storedInvalid) {
    return (
      <div>
        {fieldLabel}
        <TextInput
          id={id}
          name={id}
          value={value}
          placeholder={placeholder || DATE_FORMAT}
          disabled={disabled || readonly}
          error={rawErrors && rawErrors.length > 0 ? rawErrors.join("\n") : "Invalid date format"}
          rightSection={
            <CloseButton
              size="sm"
              aria-label="Clear date"
              disabled={disabled || readonly}
              onClick={() => onChange(undefined)}
            />
          }
          onChange={(e) => {
            const text = e.currentTarget.value;
            if (!text.trim()) {
              onChange(undefined);
              return;
            }
            // Valid text hands the field back to the picker; anything else stays
            // as typed so the user can keep editing it.
            onChange(strictDateParser(text) ?? text);
          }}
          onBlur={() => onBlur?.(id, value)}
          onFocus={() => onFocus?.(id, value)}
          aria-labelledby={labelText ? `${id}-label` : undefined}
          aria-describedby={ariaDescribedByIds(id)}
        />
      </div>
    );
  }

  return (
    <div>
      {fieldLabel}
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
        aria-labelledby={labelText ? `${id}-label` : undefined}
        aria-describedby={ariaDescribedByIds(id)}
        popoverProps={{ withinPortal: false }}
      />
    </div>
  );
};

export default DateWidget;
