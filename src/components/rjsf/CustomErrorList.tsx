import {
  ErrorListProps,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema
} from "@rjsf/utils";
import {
  Paper,
  Title,
  Text,
  Stack,
  Button,
  Collapse,
  Code
} from "@mantine/core";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp
} from "@tabler/icons-react";
import { useState } from "react";

/** Custom ErrorList component that renders errors in a clean user-friendly format */
export default function CustomErrorList<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>({ errors }: ErrorListProps<T, S, F>) {
  const [showDevView, setShowDevView] = useState(false);

  if (!errors || errors.length === 0) {
    return null;
  }

  const errorCount = errors.length;
  const errorText = errorCount === 1 ? "error" : "errors";

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
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconAlertCircle size={20} color="var(--mantine-color-red-6)" />
            <Title order={4} c="red" fw={500}>
              {errorCount} {errorText} when validating metadata
            </Title>
          </div>
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
        </div>

        <Text size="sm" c="red">
          Please fix the incorrect fields below
        </Text>

        <Collapse in={showDevView}>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={500}>
              Raw validation errors:
            </Text>
            {errors.map((error, index) => (
              <Code key={`error-${index}`} block c="red">
                {error.stack}
              </Code>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
