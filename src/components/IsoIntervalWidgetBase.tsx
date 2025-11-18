"use client";
import { Group, Stack, Text, TextInput } from "@mantine/core";
import { WidgetProps } from "@rjsf/utils";
import DatePickerPopover from "./DatePickerPopover";
import { dateUtils } from "@/utils/dateUtils";
import { useState, useEffect, useCallback } from "react";

interface IsoIntervalWidgetBaseProps extends WidgetProps {
  orientation?: 'horizontal' | 'vertical';
}

export default function IsoIntervalWidgetBase({
  id,
  value,
  onChange,
  onBlur,
  onFocus,
  label,
  required,
  disabled,
  readonly,
  orientation = 'horizontal'
}: IsoIntervalWidgetBaseProps) {
  const parsed = dateUtils.parseInterval(value);
  const [start, setStart] = useState(parsed.start);
  const [end, setEnd] = useState(parsed.end);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  useEffect(() => {
    const p = dateUtils.parseInterval(value);
    setStart(p.start);
    setEnd(p.end);
  }, [value]);

  const emit = useCallback((s: string, e: string) => {
    const newVal = dateUtils.buildInterval(s, e);
    onChange(newVal ?? undefined);
  }, [onChange]);

  const handleStartChange = (val: string) => {
    setStart(val);
    emit(val, end);
  };

  const handleEndChange = (val: string) => {
    setEnd(val);
    emit(start, val);
  };

  const Container = orientation === 'horizontal' ? Group : Stack;
  const containerProps = orientation === 'horizontal'
    ? { grow: true, gap: "sm" as const }
    : { gap: "sm" as const };

  return (
    <div id={id}>
      {orientation === 'horizontal' && label && (
        <Text size="sm" fw={500} mb="xs">
          {label}
          {required && <Text component="span" c="red"> *</Text>}
        </Text>
      )}
      <Container {...containerProps}>
        <div style={{ position: "relative" }}>
          <TextInput
            label={orientation === 'vertical' ? "Start Date" : "Start date"}
            value={start}
            onChange={(event) => handleStartChange(event.currentTarget.value)}
            onBlur={() => {
              setStartTouched(true);
              onBlur && onBlur(id, start);
            }}
            onFocus={() => onFocus && onFocus(id, start)}
            disabled={disabled || readonly}
            placeholder="YYYY-MM-DD"
            required={required}
            error={
              startTouched && start && !dateUtils.validateDate(start)
                ? "Invalid date format"
                : undefined
            }
            rightSection={
              <DatePickerPopover
                opened={startPickerOpen}
                onChange={setStartPickerOpen}
                value={start}
                onDateChange={(dateStr) => handleStartChange(dateStr)}
                onTouched={() => setStartTouched(true)}
                disabled={disabled}
                readonly={readonly}
              />
            }
          />
        </div>
        <div style={{ position: "relative" }}>
          <TextInput
            label={orientation === 'vertical' ? "End Date" : "End date (optional)"}
            value={end}
            onChange={(event) => handleEndChange(event.currentTarget.value)}
            onBlur={() => {
              setEndTouched(true);
              onBlur && onBlur(id, end);
            }}
            onFocus={() => onFocus && onFocus(id, end)}
            disabled={disabled || readonly}
            placeholder={orientation === 'vertical' ? "YYYY-MM-DD (optional)" : "YYYY-MM-DD"}
            error={
              endTouched && end && !dateUtils.validateDate(end)
                ? "Invalid date format"
                : undefined
            }
            rightSection={
              <DatePickerPopover
                opened={endPickerOpen}
                onChange={setEndPickerOpen}
                value={end}
                onDateChange={(dateStr) => handleEndChange(dateStr)}
                onTouched={() => setEndTouched(true)}
                disabled={disabled}
                readonly={readonly}
              />
            }
          />
        </div>
      </Container>
    </div>
  );
}
