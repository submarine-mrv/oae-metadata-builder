import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  TitleFieldProps
} from "@rjsf/utils";
import FieldLabel from "./FieldLabel";

/**
 * Custom Title Field Template using reusable FieldLabel component
 * Note: TitleFieldProps doesn't include uiSchema, so modal support is not available here
 * Modal support should be enabled at the field level in custom field components
 */
export default function CustomTitleFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: TitleFieldProps<T, S, F>) {
  const { id, title, schema } = props;
  const description = schema?.description;

  // Note: useModal is always false since TitleFieldProps doesn't expose uiSchema
  return (
    <FieldLabel
      label={title}
      description={description}
      useModal={false}
      order={4}
      fw={500}
    />
  );
}
