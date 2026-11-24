import { Badge, Code, Text } from "@mantine/core";
import { type DiffSide, type JsonDiffRow, jsonDiff } from "@/utils/jsonDiff";

const CHANGE_LABELS: Record<JsonDiffRow["change"], string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
};

const CHANGE_COLORS: Record<JsonDiffRow["change"], string> = {
  added: "green",
  removed: "red",
  changed: "yellow",
};

export function formatJson(side: DiffSide): string {
  return side.present ? (JSON.stringify(side.value, null, 2) ?? String(side.value)) : "";
}

type DiffValueProps = {
  side: DiffSide;
  tone: "local" | "remote";
  heading: string;
};

/** One side of a changed path; the heading only shows when the columns stack. */
function DiffValue({ side, tone, heading }: DiffValueProps) {
  return (
    <div className="min-w-0">
      <Text size="xs" c="dimmed" className="sm:hidden">
        {heading}
      </Text>
      {side.present ? (
        <Code
          block
          color={tone === "local" ? "red.0" : "green.0"}
          className="max-h-64 overflow-auto whitespace-pre-wrap break-words"
        >
          {formatJson(side)}
        </Code>
      ) : (
        <Text size="sm" fs="italic" c="dimmed">
          Not present
        </Text>
      )}
    </div>
  );
}

type JsonDiffViewerProps = {
  left: DiffSide;
  right: DiffSide;
  leftLabel?: string;
  rightLabel?: string;
};

/** Only the paths that differ, with each side's value at that path. */
export function JsonDiffViewer({
  left,
  right,
  leftLabel = "My current value",
  rightLabel = "Incoming value",
}: JsonDiffViewerProps) {
  const rows = jsonDiff(left, right);
  if (!rows.length) {
    return (
      <Text size="sm" c="dimmed">
        No differences.
      </Text>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="json-diff">
      <div className="hidden grid-cols-2 gap-3 sm:grid">
        <Text size="xs" fw={600} c="dimmed">
          {leftLabel}
        </Text>
        <Text size="xs" fw={600} c="dimmed">
          {rightLabel}
        </Text>
      </div>
      {rows.map((row) => (
        <div key={row.path} className="flex flex-col gap-1 border-t border-gray-200 pt-2">
          <div className="flex items-center gap-2">
            <Text size="xs" ff="monospace" className="break-all">
              {row.path || "(whole value)"}
            </Text>
            <Badge size="xs" variant="light" color={CHANGE_COLORS[row.change]}>
              {CHANGE_LABELS[row.change]}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DiffValue side={row.left} tone="local" heading={leftLabel} />
            <DiffValue side={row.right} tone="remote" heading={rightLabel} />
          </div>
        </div>
      ))}
      <Text size="xs" c="dimmed">
        Changes only; unchanged properties are omitted.
      </Text>
    </div>
  );
}
