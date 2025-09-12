import { useMemo } from 'react';
import {
  ArrayFieldItemButtonsTemplateType,
  buttonId,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';
import { ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

export default function CustomArrayFieldItemButtonsTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: ArrayFieldItemButtonsTemplateType<T, S, F>) {
  const {
    disabled,
    hasRemove,
    idSchema,
    index,
    onDropIndexClick,
    readonly,
  } = props;
  
  const onRemoveClick = useMemo(() => onDropIndexClick(index), [index, onDropIndexClick]);

  return (
    <>
      {hasRemove && (
        <ActionIcon
          id={buttonId<T>(idSchema, 'remove')}
          className='rjsf-array-item-remove'
          size='sm'
          variant='subtle'
          color='red'
          disabled={disabled || readonly}
          onClick={onRemoveClick}
        >
          <IconTrash size={16} />
        </ActionIcon>
      )}
    </>
  );
}