"use client";
import React, { useCallback, useRef, useState } from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Paper,
  Group,
  Button,
  Badge,
  ThemeIcon,
  Accordion,
  Code,
  Alert,
} from "@mantine/core";
import {
  IconUpload,
  IconCircleCheck,
  IconAlertTriangle,
  IconCircleX,
  IconFileCheck,
  IconX,
} from "@tabler/icons-react";
import AppLayout from "@/components/AppLayout";
import type {
  ComplianceReport,
  CheckResult,
  CheckSeverity,
} from "@/utils/complianceChecker";
import { runComplianceChecks } from "@/utils/complianceChecker";

const ACCEPTED_EXTENSIONS = ".csv,.tsv,.xlsx,.xls,.nc,.netcdf";

const SEVERITY_CONFIG: Record<
  CheckSeverity,
  { color: string; icon: React.ReactNode; label: string }
> = {
  pass: {
    color: "green",
    icon: <IconCircleCheck size={18} />,
    label: "Pass",
  },
  warn: {
    color: "yellow",
    icon: <IconAlertTriangle size={18} />,
    label: "Warning",
  },
  fail: {
    color: "red",
    icon: <IconCircleX size={18} />,
    label: "Fail",
  },
};

function CheckResultItem({ result }: { result: CheckResult }) {
  const config = SEVERITY_CONFIG[result.severity];
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap" py={4}>
      <ThemeIcon
        color={config.color}
        variant="light"
        size="sm"
        style={{ flexShrink: 0, marginTop: 2 }}
      >
        {config.icon}
      </ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text size="sm">{result.message}</Text>
        {result.details && (
          <Code block mt={4} style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {result.details}
          </Code>
        )}
      </div>
    </Group>
  );
}

function SummaryBadges({
  summary,
}: {
  summary: ComplianceReport["summary"];
}) {
  return (
    <Group gap="xs">
      {summary.pass > 0 && (
        <Badge color="green" variant="light" size="lg">
          {summary.pass} passed
        </Badge>
      )}
      {summary.warn > 0 && (
        <Badge color="yellow" variant="light" size="lg">
          {summary.warn} warning{summary.warn !== 1 ? "s" : ""}
        </Badge>
      )}
      {summary.fail > 0 && (
        <Badge color="red" variant="light" size="lg">
          {summary.fail} failed
        </Badge>
      )}
    </Group>
  );
}

function ReportDisplay({ report }: { report: ComplianceReport }) {
  const groupedChecks = {
    fail: report.checks.filter((c) => c.severity === "fail"),
    warn: report.checks.filter((c) => c.severity === "warn"),
    pass: report.checks.filter((c) => c.severity === "pass"),
  };

  return (
    <Stack gap="md">
      <Paper shadow="sm" p="lg" withBorder>
        <Group justify="space-between" align="center" mb="md">
          <Group gap="sm">
            <ThemeIcon color="blue" variant="light" size="lg">
              <IconFileCheck size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>{report.filename}</Text>
              <Text size="xs" c="dimmed">
                {report.fileType.toUpperCase()} file &middot;{" "}
                {report.columnHeaders.length} column
                {report.columnHeaders.length !== 1 ? "s" : ""} detected
              </Text>
            </div>
          </Group>
          <SummaryBadges summary={report.summary} />
        </Group>

        <Accordion variant="separated" multiple defaultValue={["results"]}>
          <Accordion.Item value="results">
            <Accordion.Control>Validation Results</Accordion.Control>
            <Accordion.Panel>
              <Stack gap={2}>
                {groupedChecks.fail.map((c, i) => (
                  <CheckResultItem key={`fail-${i}`} result={c} />
                ))}
                {groupedChecks.warn.map((c, i) => (
                  <CheckResultItem key={`warn-${i}`} result={c} />
                ))}
                {groupedChecks.pass.map((c, i) => (
                  <CheckResultItem key={`pass-${i}`} result={c} />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="columns">
            <Accordion.Control>
              Detected Columns ({report.columnHeaders.length})
            </Accordion.Control>
            <Accordion.Panel>
              <Code block style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
                {report.columnHeaders.join("\n")}
              </Code>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Paper>
    </Stack>
  );
}

export default function CheckerPage() {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setReport(null);

    try {
      const result = await runComplianceChecks({ file });
      setReport(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClear = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return (
    <AppLayout>
      <Container size="md" py="xl">
        <Stack gap="lg">
          <div>
            <Title order={2}>Compliance Checker</Title>
            <Text c="dimmed" mt="xs">
              Upload a CSV, Excel, or NetCDF data file to check column headers
              against the OAE Data Protocol&apos;s recommended variable names.
            </Text>
          </div>

          {/* Drop zone */}
          <Paper
            shadow="sm"
            p="xl"
            withBorder
            style={{
              borderStyle: "dashed",
              borderWidth: 2,
              borderColor: isDragging
                ? "var(--mantine-color-blue-5)"
                : undefined,
              backgroundColor: isDragging
                ? "var(--mantine-color-blue-0)"
                : undefined,
              cursor: "pointer",
              transition: "border-color 150ms, background-color 150ms",
            }}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Stack align="center" gap="sm">
              <ThemeIcon size="xl" variant="light" color="blue">
                <IconUpload size={24} />
              </ThemeIcon>
              <Text fw={500}>Drop a file here or click to browse</Text>
              <Text size="sm" c="dimmed">
                Accepts CSV, Excel (.xlsx), and NetCDF (.nc) files
              </Text>
            </Stack>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </Paper>

          {/* Error display */}
          {error && (
            <Alert
              color="red"
              icon={<IconCircleX size={18} />}
              title="Error"
              withCloseButton
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {/* Results */}
          {report && (
            <>
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconX size={14} />}
                  onClick={handleClear}
                >
                  Clear results
                </Button>
              </Group>
              <ReportDisplay report={report} />
            </>
          )}
        </Stack>
      </Container>
    </AppLayout>
  );
}
