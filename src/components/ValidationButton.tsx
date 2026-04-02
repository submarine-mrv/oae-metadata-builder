import React from "react";
import { Badge } from "@mantine/core";
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
  return (
    <Badge
      component="button"
      onClick={onClick}
      leftSection={
        validationPassed === true
          ? <IconCheck size={14} />
          : <IconShieldCheck size={14} />
      }
      variant="light"
      color={validationPassed === true ? "green" : "gray"}
      size="lg"
      style={{ cursor: "pointer" }}
    >
      {validationPassed === true ? "Validation Passed" : "Run Validation"}
    </Badge>
  );
}