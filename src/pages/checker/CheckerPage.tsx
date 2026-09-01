import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Code,
  Container,
  Group,
  List,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconFileCheck,
  IconInfoCircle,
  IconPointFilled,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import type {
  CheckResult,
  CheckSeverity,
  ComplianceReport,
  ParsedColumn,
  TemplateSelection,
} from "@/utils/complianceChecker";
import { runComplianceChecks, unitsLabel } from "@/utils/complianceChecker";
import { DATA_FILE_TEMPLATES } from "@/utils/dataFileTemplates";

/** Spreadsheet templates the checker matches files against. */
const TEMPLATES_URL =
  "https://drive.google.com/drive/folders/1lrHXLBPoYUe3oiEAZtDY8ojw5x0n8Yjd?usp=sharing";

/** Protocol section defining column header names; its subsections cover each file type. */
const COLUMN_HEADERS_URL =
  "https://www.carbontosea.org/oae-data-protocol/1-0-0/#column-header-names";

const ACCEPTED_EXTENSIONS = ".csv,.tsv,.xlsx,.xls,.nc,.netcdf";

/** Whole files are read into memory and parsed on the main thread. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const formatMb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

const TEMPLATE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  ...DATA_FILE_TEMPLATES.map((t) => ({ value: t.id, label: t.label })),
  { value: "none", label: "Not a template file" },
];

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

function SummaryBadges({ summary }: { summary: ComplianceReport["summary"] }) {
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

/**
 * One table for every format: a NetCDF units attribute and a spreadsheet units
 * row are both just a column's units by the time they reach here.
 */
function ColumnsTable({ columns }: { columns: ParsedColumn[] }) {
  return (
    <Table striped withTableBorder verticalSpacing={4} fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Column</Table.Th>
          <Table.Th w="45%">Units</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {columns.map((c) => (
          <Table.Tr key={c.name}>
            <Table.Td>
              <Code fz="xs">{c.name}</Code>
            </Table.Td>
            <Table.Td>
              {c.units.kind === "declared" ? (
                <Code fz="xs">{c.units.value}</Code>
              ) : (
                <Text size="xs" c="dimmed" fs="italic">
                  {unitsLabel(c.units)}
                </Text>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
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
                {report.fileType.toUpperCase()} file &middot; {report.columns.length} column
                {report.columns.length !== 1 ? "s" : ""} detected
                {report.template ? ` · ${report.template.label} template` : ""}
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
            <Accordion.Control>Columns and Units ({report.columns.length})</Accordion.Control>
            <Accordion.Panel>
              <ColumnsTable columns={report.columns} />
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
  const [selection, setSelection] = useState<TemplateSelection>("auto");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestUpload = useRef(0);
  // Kept so changing the data type re-checks without re-picking the file.
  const lastFile = useRef<File | null>(null);

  const handleFile = useCallback(async (file: File, template: TemplateSelection) => {
    setError(null);
    setReport(null);
    lastFile.current = file;

    // Claim the slot before anything can return early. Parsing is async, so a
    // parse already in flight must be invalidated even when this upload is
    // rejected outright — otherwise it resolves and overwrites the rejection.
    const upload = ++latestUpload.current;

    if (file.size > MAX_FILE_BYTES) {
      setError(
        `${file.name} is ${formatMb(file.size)}, over the ${formatMb(MAX_FILE_BYTES)} limit. ` +
          "Parsing runs in the browser on the main thread; check a subset instead.",
      );
      return;
    }

    try {
      const result = await runComplianceChecks(file, template);
      if (upload === latestUpload.current) setReport(result);
    } catch (err) {
      if (upload === latestUpload.current) {
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      }
    }
  }, []);

  const handleTemplateChange = useCallback(
    (value: string | null) => {
      const next = (value ?? "auto") as TemplateSelection;
      setSelection(next);
      if (lastFile.current) handleFile(lastFile.current, next);
    },
    [handleFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file, selection);
      e.target.value = "";
    },
    [handleFile, selection],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file, selection);
    },
    [handleFile, selection],
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
              Upload a CSV, Excel, or NetCDF data file to check column headers against the OAE Data
              Protocol&apos;s recommended variable names.
            </Text>

            <Alert
              variant="light"
              color="yellow"
              icon={<IconInfoCircle size={18} />}
              title="Beta Version"
              mt="md"
            >
              <Stack gap="xs">
                <Text size="sm">
                  This Compliance Checker (beta) is a tool to assist with validation of individual
                  dataset files against the{" "}
                  <Anchor href={TEMPLATES_URL} target="_blank" rel="noopener noreferrer">
                    spreadsheet templates
                  </Anchor>{" "}
                  and the{" "}
                  <Anchor href={COLUMN_HEADERS_URL} target="_blank" rel="noopener noreferrer">
                    column header names
                  </Anchor>{" "}
                  sections of the OAE Data Protocol.
                </Text>
                <Text size="sm">It checks four things:</Text>
                {/* Tailwind's preflight resets `ul { list-style: none }`, so CSS markers
                    never show. An explicit icon draws the bullet instead, matching
                    WorkflowCard. */}
                <List
                  size="sm"
                  spacing={4}
                  icon={<IconPointFilled size={10} style={{ marginTop: 6 }} />}
                >
                  <List.Item>
                    column headers against the template&apos;s expected variable names
                  </List.Item>
                  <List.Item>QC flag columns are present where necessary</List.Item>
                  <List.Item>
                    units strings are present for necessary columns, as a row below the column
                    header
                  </List.Item>
                  <List.Item>CF standard names are set (NetCDF files only)</List.Item>
                </List>
                <Text size="sm">
                  Importantly, the compliance checker does not check data values. Passing every
                  check does not by itself make a submission complete.
                </Text>
                <Text size="sm">
                  Accepts .csv, .tsv, .xlsx, .xls, .nc and .netcdf up to {formatMb(MAX_FILE_BYTES)}.
                  NetCDF files must be classic or 64-bit offset format (NetCDF 3) — NetCDF 4, which
                  is built on HDF5, is not supported yet. Files are parsed in your browser and never
                  uploaded to a server.
                </Text>
              </Stack>
            </Alert>
          </div>

          <Select
            label="Data type"
            description="Which protocol template this file follows. Auto-detect matches on column names."
            data={TEMPLATE_OPTIONS}
            value={selection}
            onChange={handleTemplateChange}
            allowDeselect={false}
            maw={360}
          />

          {/* Drop zone */}
          <Paper
            shadow="sm"
            p="xl"
            withBorder
            style={{
              borderStyle: "dashed",
              borderWidth: 2,
              borderColor: isDragging ? "var(--mantine-color-blue-5)" : undefined,
              backgroundColor: isDragging ? "var(--mantine-color-blue-0)" : undefined,
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
