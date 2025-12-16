import {
  ArrayFieldItemButtonsTemplateProps,
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
>(props: ArrayFieldItemButtonsTemplateProps<T, S, F>) {
  const {
    disabled,
    hasRemove,
    fieldPathId,
    onRemoveItem,
    readonly,
  } = props;

  return (
    <>
      {hasRemove && (
        <ActionIcon
          id={`${fieldPathId.$id}-remove`}
          className='rjsf-array-item-remove'
          size='sm'
          variant='subtle'
          color='red'
          disabled={disabled || readonly}
          onClick={onRemoveItem}
        >
          <IconTrash size={16} />
        </ActionIcon>
      )}
    </>
  );
}