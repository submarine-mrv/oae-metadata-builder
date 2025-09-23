import { Title, Tooltip, ActionIcon, Group } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  TitleFieldProps
} from "@rjsf/utils";

export default function CustomTitleFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: TitleFieldProps<T, S, F>) {
  const { id, title, schema } = props;
  const description = schema?.description;

  return (
    <Group gap="xs" align="center" mb="xs">
      <Title order={4} size="sm" fw={500} id={id}>
        {title}
      </Title>
      {description && (
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
    </Group>
  );
}
