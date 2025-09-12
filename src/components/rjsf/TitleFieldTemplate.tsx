import { Title } from '@mantine/core';
import { FormContextType, RJSFSchema, StrictRJSFSchema, TitleFieldProps } from '@rjsf/utils';

export default function CustomTitleFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: TitleFieldProps<T, S, F>) {
  const { id, title, required } = props;
  
  return (
    <Title order={4} size="sm" mb="xs" fw={500} id={id}>
      {title}
    </Title>
  );
}