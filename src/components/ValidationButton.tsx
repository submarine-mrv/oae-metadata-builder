import React from "react";
import { Button } from "@mantine/core";
import { IconCheck, IconShieldCheck } from "@tabler/icons-react";

interface ValidationButtonProps {
  /** null = not yet run, true = passed, false = failed */
  validationPassed: boolean | null;
  onClick: () => void;
}

export default function ValidationButton({
  validationPassed,
  onClick
}: ValidationButtonProps) {
  if (validationPassed === true) {
    return (
      <Button
        variant="light"
        color="green"
        leftSection={<IconCheck size={18} />}
        onClick={onClick}
      >
        Validation Passed
      </Button>
    );
  }

  return (
    <Button
      variant="light"
      leftSection={<IconShieldCheck size={18} />}
      onClick={onClick}
    >
      Run Validation
    </Button>
  );
}