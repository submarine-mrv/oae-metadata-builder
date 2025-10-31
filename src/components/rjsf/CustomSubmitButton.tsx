import { Button } from "@mantine/core";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  SubmitButtonProps
} from "@rjsf/utils";

export default function CustomSubmitButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: SubmitButtonProps<T, S, F>) {
  const { uiSchema } = props;

  return (
    <Button type="submit" variant="filled">
      Download Metadata File
    </Button>
  );
}
