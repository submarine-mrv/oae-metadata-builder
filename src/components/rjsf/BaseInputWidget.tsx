/**
 * BaseInputWidget - Custom RJSF widget that mirrors @rjsf/mantine's BaseInputTemplate behavior
 *
 * This widget intelligently chooses between NumberInput and TextInput based on the schema type,
 * similar to how Mantine's BaseInputTemplate works. It also adds our custom tooltip/modal
 * functionality for field descriptions.
 *
 * Key behaviors mirrored from @rjsf/mantine BaseInputTemplate:
 * - Uses NumberInput for schema types 'number' and 'integer'
 * - Uses TextInput for all other types
 * - Handles input props, validation, and examples consistently
 * - Maintains proper focus, blur, and change event handling
 */

import React, { useCallback, FocusEvent, useState } from 'react';
import { TextInput, NumberInput, Tooltip, ActionIcon, Text, Box } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import DescriptionModal from './DescriptionModal';
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';

export default function BaseInputWidget<
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
  const [modalOpened, setModalOpened] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Simple check: use NumberInput for number/integer schema types
  const isNumberType = schema.type === 'number' || schema.type === 'integer';
  const schemaMin = typeof schema.minimum === 'number' ? schema.minimum : undefined;
  const schemaMax = typeof schema.maximum === 'number' ? schema.maximum : undefined;

  const handleNumberChange = useCallback(
    (value: number | string) => {
      setLocalError(null);
      if (onChange) {
        onChange(value);
      }
    },
    [onChange]
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(event.target.value === '' ? undefined : event.target.value);
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (isNumberType) {
        const numVal = parseFloat(event.target.value);
        if (!isNaN(numVal)) {
          if (schemaMax !== undefined && numVal > schemaMax) {
            setLocalError(`Must be ${schemaMax} or less`);
          } else if (schemaMin !== undefined && numVal < schemaMin) {
            setLocalError(`Must be ${schemaMin} or greater`);
          } else {
            setLocalError(null);
          }
        } else {
          setLocalError(null);
        }
      }
      if (onBlur) {
        onBlur(id, event.target.value);
      }
    },
    [onBlur, id, isNumberType, schemaMin, schemaMax]
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
    return label;
  };

  const errorMessage = rawErrors && rawErrors.length > 0
    ? rawErrors.join(', ')
    : localError ?? undefined;

  // Choose NumberInput vs TextInput based on schema type
  const input = isNumberType ? (
    <NumberInput
      id={id}
      label={renderLabel()}
      placeholder={placeholder}
      value={value ?? ''}
      required={required}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      error={errorMessage}
      onChange={handleNumberChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  ) : (
    <TextInput
      id={id}
      label={renderLabel()}
      placeholder={placeholder}
      value={value ?? ''}
      required={required}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      error={errorMessage}
      onChange={handleTextChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );

  return (
    <>
      <Box style={{ position: 'relative' }}>
        {input}
        {description && !hideLabel && (
          <Box style={{
            position: 'absolute',
            top: '2px',
            left: '0',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}>
            <Text
              size="sm"
              fw={500}
              style={{
                visibility: 'hidden',
                marginRight: '4px'
              }}
            >
              {label}{required && ' *'}
            </Text>
            <Box style={{ pointerEvents: 'auto' }}>
              {useModal ? (
                <ActionIcon
                  variant="transparent"
                  size="xs"
                  color="gray"
                  onClick={() => setModalOpened(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <IconInfoCircle size={14} />
                </ActionIcon>
              ) : (
                <Tooltip
                  label={description}
                  position="top"
                  withArrow
                  multiline
                  maw={400}
                  style={{ wordWrap: "break-word" }}
                >
                  <ActionIcon variant="transparent" size="xs" color="gray">
                    <IconInfoCircle size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {useModal && description && (
        <DescriptionModal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          title={label}
          description={description}
        />
      )}

    </>
  );
}