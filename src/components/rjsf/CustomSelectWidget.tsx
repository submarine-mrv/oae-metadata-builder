import { Alert, MultiSelect, Select } from "@mantine/core";
import {
  ariaDescribedByIds,
  enumOptionsIndexForValue,
  enumOptionsValueForIndex,
  type FormContextType,
  labelValue,
  type RJSFSchema,
  type StrictRJSFSchema,
  type WidgetProps,
} from "@rjsf/utils";
import { IconInfoCircle } from "@tabler/icons-react";
import { type FocusEvent, useCallback, useMemo } from "react";
import FieldLabel from "./FieldLabel";

export default function CustomSelectWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: WidgetProps<T, S, F>) {
  const {
    id,
    value,
    placeholder,
    required,
    disabled,
    readonly,
    autofocus,
    label,
    hideLabel,
    multiple,
    rawErrors,
    options,
    onChange,
    onBlur,
    onFocus,
    schema,
    uiSchema,
  } = props;

  const { enumOptions, enumDisabled, emptyValue } = options;
  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true;
  const viewAllLink = uiSchema?.["ui:viewAllLink"] as string | undefined;
  // `ui:valueNotice` maps an enum value to a note shown beneath the select
  // while that value is chosen. For rules a single field cannot express, such
  // as "open access needs a link or a date", stated up front instead of as an
  // error after the fact.
  const valueNotice = uiSchema?.["ui:valueNotice"] as Record<string, string> | undefined;
  const notice = !multiple && typeof value === "string" ? valueNotice?.[value] : undefined;

  const handleChange = useCallback(
    (nextValue: any) => {
      if (!disabled && !readonly && onChange) {
        onChange(enumOptionsValueForIndex<S>(nextValue, enumOptions, emptyValue));
      }
    },
    [onChange, disabled, readonly, enumOptions, emptyValue],
  );

  const handleBlur = useCallback(
    ({ target }: FocusEvent<HTMLInputElement>) => {
      if (onBlur) {
        onBlur(id, enumOptionsValueForIndex<S>(target?.value, enumOptions, emptyValue));
      }
    },
    [onBlur, id, enumOptions, emptyValue],
  );

  const handleFocus = useCallback(
    ({ target }: FocusEvent<HTMLInputElement>) => {
      if (onFocus) {
        onFocus(id, enumOptionsValueForIndex<S>(target?.value, enumOptions, emptyValue));
      }
    },
    [onFocus, id, enumOptions, emptyValue],
  );

  const selectedIndexes = enumOptionsIndexForValue<S>(value, enumOptions, multiple);

  const selectOptions = useMemo(() => {
    if (Array.isArray(enumOptions)) {
      return enumOptions.map((option, index) => ({
        value: String(index),
        label: option.label,
        disabled: Array.isArray(enumDisabled) && enumDisabled.indexOf(option.value) !== -1,
      }));
    }
    return [];
  }, [enumDisabled, enumOptions]);

  const Component = multiple ? MultiSelect : Select;
  const labelText = labelValue(label || undefined, hideLabel, false);

  return (
    <div>
      {labelText && (
        <FieldLabel
          label={String(labelText)}
          description={description}
          required={required}
          useModal={useModal}
          viewAllLink={viewAllLink}
        />
      )}

      <Component
        id={id}
        name={id}
        data={selectOptions}
        value={multiple ? (selectedIndexes as any) : (selectedIndexes as string)}
        onChange={!readonly ? handleChange : undefined}
        onBlur={!readonly ? handleBlur : undefined}
        onFocus={!readonly ? handleFocus : undefined}
        autoFocus={autofocus}
        placeholder={
          multiple && Array.isArray(selectedIndexes) && selectedIndexes.length > 0
            ? undefined
            : placeholder || "Select\u2026"
        }
        disabled={disabled || readonly}
        error={rawErrors && rawErrors.length > 0 ? rawErrors.join("\n") : undefined}
        searchable
        clearable={!multiple}
        aria-describedby={ariaDescribedByIds(id)}
        comboboxProps={{ withinPortal: false }}
      />
      {notice && (
        <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />} mt="xs" p="xs">
          {notice}
        </Alert>
      )}
    </div>
  );
}
