import React from "react";
import { Button } from "@mantine/core";
import { IconCheck, IconShieldCheck, IconAlertCircle } from "@tabler/icons-react";
import type { BadgeState } from "@/hooks/useFormValidation";

interface ValidationButtonProps {
  badgeState: BadgeState;
  missingRequired: number;
  otherErrors: number;
  onClick: () => void;
}

interface ButtonConfig {
  label: string;
  color: string;
  icon: React.ReactNode;
  clickable: boolean;
}

function getButtonConfig(
  badgeState: BadgeState,
  missingRequired: number,
  otherErrors: number
): ButtonConfig {
  const errorWord = (n: number) => (n === 1 ? "error" : "errors");

  switch (badgeState) {
    case "empty":
      return {
        label: `${missingRequired} required fields`,
        color: "gray",
        icon: <IconShieldCheck size={14} />,
        clickable: false
      };
    case "missing-only":
      return {
        label: `${missingRequired} required fields missing`,
        color: "blue",
        icon: <IconShieldCheck size={14} />,
        clickable: true
      };
    case "missing-and-errors":
      return {
        label: `${missingRequired} required fields missing, ${otherErrors} ${errorWord(otherErrors)}`,
        color: "red",
        icon: <IconAlertCircle size={14} />,
        clickable: true
      };
    case "errors-only":
      return {
        label: `${otherErrors} ${errorWord(otherErrors)}`,
        color: "red",
        icon: <IconAlertCircle size={14} />,
        clickable: true
      };
    case "passed":
      return {
        label: "Validated",
        color: "green",
        icon: <IconCheck size={14} />,
        clickable: false
      };
  }
}

export default function ValidationButton({
  badgeState,
  missingRequired,
  otherErrors,
  onClick
}: ValidationButtonProps) {
  const { label, color, icon, clickable } = getButtonConfig(
    badgeState,
    missingRequired,
    otherErrors
  );

  return (
    <Button
      variant="outline"
      color={color}
      size="compact-sm"
      leftSection={icon}
      onClick={clickable ? onClick : undefined}
      radius="xl"
      w="fit-content"
      style={{ cursor: clickable ? "pointer" : "default" }}
    >
      {label}
    </Button>
  );
}
