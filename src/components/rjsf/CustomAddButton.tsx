import { Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import {
  FormContextType,
  IconButtonProps,
  RJSFSchema,
  StrictRJSFSchema
} from "@rjsf/utils";

export default function CustomAddButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: IconButtonProps<T, S, F>) {
  const {
    disabled,
    onClick,
    uiSchema
  } = props;

  // Check for custom add button text in ui:options
  const addItemText = uiSchema?.["ui:options"]?.addItemText || "Add Item";

  return (
    <Button
      variant="outline"
      size="sm"
      leftSection={<IconPlus size={16} />}
      disabled={disabled}
      onClick={onClick}
    >
      {addItemText}
    </Button>
  );
}