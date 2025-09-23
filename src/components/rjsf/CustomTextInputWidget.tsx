import React, { useCallback, FocusEvent, useState } from 'react';
import { TextInput, Group, Tooltip, ActionIcon, Text, Box } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import DescriptionModal from './DescriptionModal';
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
  const [modalOpened, setModalOpened] = useState(false);

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
    <>
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
          error={rawErrors?.length > 0 ? rawErrors.join(', ') : undefined}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          aria-describedby={ariaDescribedByIds<T>(id)}
        />
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