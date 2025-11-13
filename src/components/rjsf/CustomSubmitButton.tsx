import { Button } from "@mantine/core";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  SubmitButtonProps
} from "@rjsf/utils";

interface CustomSubmitButtonProps<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
> extends SubmitButtonProps<T, S, F> {
  buttonText?: string;
}

export default function CustomSubmitButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: CustomSubmitButtonProps<T, S, F>) {
  const { buttonText = "Download Metadata File" } = props;

  return (
    <Button type="submit" variant="filled">
      {buttonText}
    </Button>
  );
}
