import { useState } from "react";
import {
  ArrayFieldTitleProps,
  FormContextType,
  getUiOptions,
  RJSFSchema,
  StrictRJSFSchema
} from "@rjsf/utils";
import { Group, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import DescriptionModal from "./DescriptionModal";

/**
 * Custom ArrayFieldTitleTemplate that renders array field titles
 * with an info icon showing the description (tooltip or modal)
 */
export default function CustomArrayFieldTitleTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: ArrayFieldTitleProps<T, S, F>) {
  const { title, required, schema, uiSchema } = props;
  const [modalOpen, setModalOpen] = useState(false);

  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const description = schema?.description || uiOptions?.description;
  const useModal = uiOptions?.descriptionModal === true;

  if (!description) {
    // No description - just render the title with proper styling
    return (
      <Text size="sm" fw={500}>
        {title} {required && <span style={{ color: "red" }}>*</span>}
      </Text>
    );
  }

  return (
    <>
      <Group gap={4} wrap="nowrap" align="center">
        <Text size="sm" fw={500} style={{ margin: 0 }}>
          {title} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
        {useModal ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onClick={() => setModalOpen(true)}
            style={{ cursor: "pointer" }}
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
      </Group>
      {useModal && (
        <DescriptionModal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          title={title || ""}
          description={description}
        />
      )}
    </>
  );
}
