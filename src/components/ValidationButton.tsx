import React from "react";
import { Button } from "@mantine/core";
import { IconCheck, IconShieldCheck, IconAlertCircle } from "@tabler/icons-react";

interface ValidationButtonProps {
  /** null = not yet run, true = passed, false = failed */
  validationPassed: boolean | null;
  onClick: () => void;
}

export default function ValidationButton({
  validationPassed,
  onClick
}: ValidationButtonProps) {
  const icon =
    validationPassed === true
      ? <IconCheck size={14} />
      : validationPassed === false
        ? <IconAlertCircle size={14} />
        : <IconShieldCheck size={14} />;

  const label =
    validationPassed === true
      ? "Validated"
      : validationPassed === false
        ? "Validation Failed"
        : "Validate Metadata";

  const color =
    validationPassed === true
      ? "green"
      : validationPassed === false
        ? "red"
        : "blue";

  return (
    <Button
      variant="outline"
      color={color}
      size="compact-sm"
      leftSection={icon}
      onClick={onClick}
      radius="xl"
      w="fit-content"
    >
      {label}
    </Button>
  );
}