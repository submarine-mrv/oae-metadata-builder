/**
 * IdFieldLayout - Shared layout for ID field widgets
 *
 * Provides consistent structure: Input (flex) + Action Button with error margin handling
 */

import React from "react";
import { Group, Box, Tooltip, ActionIcon } from "@mantine/core";

interface IdFieldLayoutProps {
  children: React.ReactNode;
  buttonIcon: React.ReactNode;
  buttonTooltip: string;
  buttonVariant: "light" | "default";
  buttonAriaLabel: string;
  onButtonClick: () => void;
  buttonDisabled?: boolean;
  hasError?: boolean;
}

export function IdFieldLayout({
  children,
  buttonIcon,
  buttonTooltip,
  buttonVariant,
  buttonAriaLabel,
  onButtonClick,
  buttonDisabled = false,
  hasError = false
}: IdFieldLayoutProps) {
  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <Box style={{ flex: 1 }}>{children}</Box>
      <Box mb={hasError ? 22 : 0}>
        <Tooltip label={buttonTooltip} withArrow>
          <ActionIcon
            variant={buttonVariant}
            size="lg"
            onClick={onButtonClick}
            disabled={buttonDisabled}
            aria-label={buttonAriaLabel}
          >
            {buttonIcon}
          </ActionIcon>
        </Tooltip>
      </Box>
    </Group>
  );
}
