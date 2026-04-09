import {
  ErrorListProps,
  FormContextType,
  RJSFSchema,
  RJSFValidationError,
  StrictRJSFSchema
} from "@rjsf/utils";
import {
  ActionIcon,
  Paper,
  Title,
  Text,
  Stack,
  Button,
  Collapse,
  Code,
  List
} from "@mantine/core";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconX
} from "@tabler/icons-react";
import { useState } from "react";

/**
 * Convert a property path like ".data_submitter.email" to a readable format
 * like "Data Submitter → Email"
 */
function formatPropertyPath(property: string | undefined): string {
  if (!property || property === ".") return "";

  return (
    property
      .replace(/^\./, "") // Remove leading dot
      .split(".")
      .map((part) =>
        part
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      )
      .join(" → ") + ": "
  );
}

/**
 * Format an error into a user-friendly message with context.
 * Messages are already normalized by transformFormErrors before reaching here.
 */
function formatError(error: RJSFValidationError): string {
  const path = formatPropertyPath(error.property);
  const message = error.message || "Field is invalid";
  if (path) {
    return `${path} ${message}`;
  }
  return message;
}

/** Custom ErrorList component that renders errors in a clean user-friendly format */
export default function CustomErrorList<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>({ errors, registry }: ErrorListProps<T, S, F>) {
  const [showDevView, setShowDevView] = useState(false);

  if (!errors || errors.length === 0) {
    return null;
  }

  const errorCount = errors.length;
  const errorText = errorCount === 1 ? "error" : "errors";

  // Read the close handler from formContext (set by the page)
  const onClose = (registry?.formContext as { onCloseErrorList?: () => void } | undefined)
    ?.onCloseErrorList;

  return (
    <Paper
      withBorder
      shadow="sm"
      p="md"
      mb="lg"
      style={{ borderColor: "var(--mantine-color-red-4)" }}
    >
      <Stack gap="md">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconAlertCircle size={20} color="var(--mantine-color-red-6)" />
            <Title order={4} c="red" fw={500}>
              {errorCount} {errorText} found
            </Title>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Button
              variant="subtle"
              size="xs"
              color="gray"
              leftSection={
                showDevView ? (
                  <IconChevronUp size={14} />
                ) : (
                  <IconChevronDown size={14} />
                )
              }
              onClick={() => setShowDevView(!showDevView)}
            >
              View Raw Errors
            </Button>
            {onClose && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={onClose}
                aria-label="Close error list"
              >
                <IconX size={16} />
              </ActionIcon>
            )}
          </div>
        </div>

        <List size="sm" c="red" spacing="xs">
          {errors.map((error, index) => (
            <List.Item key={`error-${index}`}>{formatError(error)}</List.Item>
          ))}
        </List>

        <Collapse in={showDevView}>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={500}>
              Raw validation errors:
            </Text>
            {errors.map((error, index) => (
              <Code key={`raw-error-${index}`} block c="red">
                {error.stack}
              </Code>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
