import { FocusEvent, useCallback, useMemo } from 'react';
import { Select, MultiSelect, Group, Title, Anchor } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import {
  ariaDescribedByIds,
  enumOptionsIndexForValue,
  enumOptionsValueForIndex,
  labelValue,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';
import { cleanupOptions } from '@rjsf/mantine/lib/utils.js';

// Configuration for view all links by field title
const VIEW_ALL_LINKS: Record<string, string> = {
  "Sea Names": "http://vocab.nerc.ac.uk/collection/C16/current/",
  "MCDR Pathway": "https://www.carbontosea.org/oae-data-protocol/1-0-0/#mcdr-pathways"
};

export default function CustomSelectWidget<
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
    multiple,
    rawErrors,
    options,
    onChange,
    onBlur,
    onFocus,
  } = props;

  const { enumOptions, enumDisabled, emptyValue } = options;
  const themeProps = cleanupOptions(options);
  // Remove descriptionModal from themeProps as it's a custom UI option, not a Mantine prop
  const { descriptionModal, ...mantineProps } = themeProps;
  const viewAllLink = VIEW_ALL_LINKS[label || ''];

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
        onBlur(id, enumOptionsValueForIndex<S>(target && target.value, enumOptions, emptyValue));
      }
    },
    [onBlur, id, enumOptions, emptyValue],
  );

  const handleFocus = useCallback(
    ({ target }: FocusEvent<HTMLInputElement>) => {
      if (onFocus) {
        onFocus(id, enumOptionsValueForIndex<S>(target && target.value, enumOptions, emptyValue));
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
        <Group gap="sm" align="center" mb="xs">
          <Title order={4} size="sm" fw={500}>
            {labelText} {required && <span style={{ color: 'red' }}>*</span>}
          </Title>
          {viewAllLink && (
            <Anchor
              href={viewAllLink}
              target="_blank"
              size="sm"
              c="blue"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              view all
              <IconExternalLink size={12} />
            </Anchor>
          )}
        </Group>
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
        placeholder={placeholder}
        disabled={disabled || readonly}
        error={rawErrors && rawErrors.length > 0 ? rawErrors.join('\n') : undefined}
        searchable
        {...mantineProps}
        aria-describedby={ariaDescribedByIds<T>(id)}
        comboboxProps={{ withinPortal: false }}
      />
    </div>
  );
}