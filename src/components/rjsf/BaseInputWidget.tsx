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

import React, { FocusEvent, useState } from 'react';
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

  // Simple check: use NumberInput for number/integer schema types
  const isNumberType = schema.type === 'number' || schema.type === 'integer';

  const handleNumberChange = (value: number | string) => {
    if (onChange) {
      onChange(value);
    }
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value === '' ? undefined : event.target.value);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      onBlur(id, event.target.value);
    }
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    if (onFocus) {
      onFocus(id, event.target.value);
    }
  };

  const renderLabel = () => {
    if (hideLabel) return undefined;
    return label;
  };

  // Choose NumberInput vs TextInput based on schema type
  const input = isNumberType ? (
    <NumberInput
      id={id}
      label={renderLabel()}
      placeholder={placeholder}
      value={value || ''}
      required={required}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      error={rawErrors && rawErrors.length > 0 ? rawErrors.join(', ') : undefined}
      onChange={handleNumberChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  ) : (
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