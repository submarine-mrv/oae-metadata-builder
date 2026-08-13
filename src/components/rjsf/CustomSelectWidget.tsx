import { MultiSelect, Select } from "@mantine/core";
import { cleanupOptions } from "@rjsf/mantine/lib/utils.js";
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
  const themeProps = cleanupOptions(options);
  // RJSF folds every ui: key into options, so our custom ones have to come out
  // of themeProps or they end up spread onto the DOM input as attributes.
  const { descriptionModal, viewAllLink, ...mantineProps } = themeProps as typeof themeProps & {
    descriptionModal?: boolean;
    viewAllLink?: string;
  };
  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true || descriptionModal === true;

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
        {...mantineProps}
        aria-describedby={ariaDescribedByIds(id)}
        comboboxProps={{ withinPortal: false }}
      />
    </div>
  );
}
