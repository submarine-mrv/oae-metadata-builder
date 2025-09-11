"use client";
import * as React from "react";
import { WidgetProps } from "@rjsf/utils";
import { TextInput, Text, Stack, ActionIcon, Popover } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import dayjs from "dayjs";

function parseInterval(v?: string | null): { start: string; end: string } {
  if (!v || typeof v !== "string") return { start: "", end: "" };
  const [start, end] = v.split("/");
  return {
    start: start || "",
    end: end && end !== ".." ? end : ""
  };
}
function buildInterval(start: string, end: string): string | undefined {
  if (!start) return undefined;
  return `${start}/${end || ".."}`;
}

const validateDate = (input: string) => {
  if (!input) return true; // empty is valid
  const d = dayjs(input, "YYYY-MM-DD", true);
  return d.isValid();
};

const parseToDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = dayjs(dateStr, "YYYY-MM-DD", true);
  return d.isValid() ? d.toDate() : null;
};

const formatFromDate = (date: Date | null): string => {
  if (!date) return "";
  return dayjs(date).format("YYYY-MM-DD");
};

const IsoIntervalWidgetVertical: React.FC<WidgetProps> = ({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  onBlur,
  onFocus,
  label
}) => {
  const { start, end } = React.useMemo(
    () => parseInterval(value as any),
    [value]
  );
  const [startDate, setStartDate] = React.useState(start);
  const [endDate, setEndDate] = React.useState(end);
  const [startPickerOpen, setStartPickerOpen] = React.useState(false);
  const [endPickerOpen, setEndPickerOpen] = React.useState(false);
  const [startTouched, setStartTouched] = React.useState(false);
  const [endTouched, setEndTouched] = React.useState(false);

  React.useEffect(() => {
    setStartDate(start);
    setEndDate(end);
  }, [start, end]);
  const emit = (s: string, e: string) =>
    onChange(buildInterval(s, e) ?? undefined);

  return (
    <div id={id}>
      {/* No label rendered - handled by parent */}
      <Stack gap="sm">
        <TextInput
          label="Start Date"
          value={startDate}
          onChange={(event) => {
            const newValue = event.currentTarget.value;
            setStartDate(newValue);
            emit(newValue, endDate);
          }}
          onBlur={() => {
            setStartTouched(true);
            onBlur && onBlur(id, startDate);
          }}
          onFocus={() => onFocus && onFocus(id, startDate)}
          disabled={disabled || readonly}
          placeholder="YYYY-MM-DD"
          required={required}
          error={
            startTouched && startDate && !validateDate(startDate)
              ? "Invalid date format"
              : undefined
          }
          rightSection={
            <Popover
              opened={startPickerOpen}
              onChange={setStartPickerOpen}
              position="bottom-end"
              withinPortal={false}
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setStartPickerOpen((o) => !o)}
                  disabled={disabled || readonly}
                >
                  <IconCalendar size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <DatePicker
                  value={parseToDate(startDate)}
                  onChange={(date) => {
                    const formatted = formatFromDate(date);
                    setStartDate(formatted);
                    emit(formatted, endDate);
                    setStartPickerOpen(false);
                  }}
                />
              </Popover.Dropdown>
            </Popover>
          }
        />

        <TextInput
          label="End Date"
          value={endDate}
          onChange={(event) => {
            const newValue = event.currentTarget.value;
            setEndDate(newValue);
            emit(startDate, newValue);
          }}
          onBlur={() => {
            setEndTouched(true);
            onBlur && onBlur(id, endDate);
          }}
          onFocus={() => onFocus && onFocus(id, endDate)}
          disabled={disabled || readonly}
          placeholder="YYYY-MM-DD (optional)"
          error={
            endTouched && endDate && !validateDate(endDate)
              ? "Invalid date format"
              : undefined
          }
          rightSection={
            <Popover
              opened={endPickerOpen}
              onChange={setEndPickerOpen}
              position="bottom-end"
              withinPortal={false}
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setEndPickerOpen((o) => !o)}
                  disabled={disabled || readonly}
                >
                  <IconCalendar size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <DatePicker
                  value={parseToDate(endDate)}
                  onChange={(date) => {
                    const formatted = formatFromDate(date);
                    setEndDate(formatted);
                    emit(startDate, formatted);
                    setEndPickerOpen(false);
                  }}
                />
              </Popover.Dropdown>
            </Popover>
          }
        />
      </Stack>
    </div>
  );
};

export default IsoIntervalWidgetVertical;