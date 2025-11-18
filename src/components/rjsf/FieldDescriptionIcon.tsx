import { useState } from "react";
import { Box, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import DescriptionModal from "./DescriptionModal";

interface FieldDescriptionIconProps {
  label?: string;
  required?: boolean;
  description?: string;
  hideLabel?: boolean;
  useModal?: boolean;
}

export function FieldDescriptionIcon({
  label,
  required,
  description,
  hideLabel,
  useModal = false
}: FieldDescriptionIconProps) {
  const [modalOpened, setModalOpened] = useState(false);

  if (!description || hideLabel) {
    return null;
  }

  return (
    <>
      <Box
        style={{
          position: "absolute",
          top: "2px",
          left: "0",
          display: "flex",
          alignItems: "center",
          pointerEvents: "none"
        }}
      >
        <Text
          size="sm"
          fw={500}
          style={{ visibility: "hidden", marginRight: "4px" }}
        >
          {label}
          {required && " *"}
        </Text>
        <Box style={{ pointerEvents: "auto" }}>
          {useModal ? (
            <ActionIcon
              variant="transparent"
              size="xs"
              color="gray"
              onClick={() => setModalOpened(true)}
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
        </Box>
      </Box>
      {useModal && (
        <DescriptionModal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          title={label || "Description"}
          description={description}
        />
      )}
    </>
  );
}
