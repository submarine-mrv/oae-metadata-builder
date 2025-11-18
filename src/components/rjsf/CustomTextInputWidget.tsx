import React, { useCallback, FocusEvent } from 'react';
import { TextInput, Box } from '@mantine/core';
import { FieldDescriptionIcon } from './FieldDescriptionIcon';
import {
  ariaDescribedByIds,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';

export default function CustomTextInputWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
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
    rawErrors,
    onChange,
    onBlur,
    onFocus,
    schema,
    uiSchema
  } = props;

  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(event.target.value === '' ? undefined : event.target.value);
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (onBlur) {
        onBlur(id, event.target.value);
      }
    },
    [onBlur, id]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (onFocus) {
        onFocus(id, event.target.value);
      }
    },
    [onFocus, id]
  );

  const renderLabel = () => {
    if (hideLabel) return undefined;
    return label; // Just return the simple label string
  };

  return (
    <Box style={{ position: 'relative' }}>
      <TextInput
        id={id}
        label={renderLabel()}
        placeholder={placeholder}
        value={value || ''}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        autoFocus={autofocus}
        error={rawErrors && rawErrors.length > 0 ? rawErrors.join(', ') : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        aria-describedby={ariaDescribedByIds<T>(id)}
      />
      <FieldDescriptionIcon
        label={label}
        required={required}
        description={description}
        hideLabel={hideLabel}
        useModal={useModal}
      />
    </Box>
  );
}