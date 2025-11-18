import React, { useCallback, FocusEvent } from 'react';
import { Textarea, Box } from '@mantine/core';
import { FieldDescriptionIcon } from './FieldDescriptionIcon';
import {
  ariaDescribedByIds,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';

export default function CustomTextareaWidget<
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
    options,
    onChange,
    onBlur,
    onFocus,
    schema,
    uiSchema
  } = props;

  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true;
  const rows = options?.rows || 4;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) {
        onChange(event.target.value === '' ? undefined : event.target.value);
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      if (onBlur) {
        onBlur(id, event.target.value);
      }
    },
    [onBlur, id]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
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
      <Textarea
        id={id}
        label={renderLabel()}
        placeholder={placeholder}
        value={value || ''}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        autoFocus={autofocus}
        rows={rows}
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