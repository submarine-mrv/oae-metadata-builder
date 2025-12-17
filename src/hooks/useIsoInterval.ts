/**
 * useIsoInterval - Shared state logic for ISO 8601 interval widgets
 *
 * Extracts the common state management from IsoIntervalWidget and
 * IsoIntervalWidgetVertical, allowing each to focus on layout.
 */
import * as React from "react";
import { parseInterval, buildInterval, validateDate } from "@/utils/dateUtils";

interface UseIsoIntervalProps {
  id: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onBlur?: (id: string, value: string) => void;
  onFocus?: (id: string, value: string) => void;
}

interface UseIsoIntervalReturn {
  startDate: string;
  endDate: string;
  startPickerOpen: boolean;
  endPickerOpen: boolean;
  startTouched: boolean;
  endTouched: boolean;
  startError: string | undefined;
  endError: string | undefined;
  setStartPickerOpen: (open: boolean) => void;
  setEndPickerOpen: (open: boolean) => void;
  handleStartChange: (value: string) => void;
  handleEndChange: (value: string) => void;
  handleStartBlur: () => void;
  handleEndBlur: () => void;
  handleStartFocus: () => void;
  handleEndFocus: () => void;
  handleStartDatePick: (formatted: string) => void;
  handleEndDatePick: (dateStr: string) => void;
  setStartTouched: (touched: boolean) => void;
  setEndTouched: (touched: boolean) => void;
}

export function useIsoInterval({
  id,
  value,
  onChange,
  onBlur,
  onFocus
}: UseIsoIntervalProps): UseIsoIntervalReturn {
  const { start, end } = React.useMemo(
    () => parseInterval(value),
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

  const emit = React.useCallback(
    (s: string, e: string) => onChange(buildInterval(s, e) ?? undefined),
    [onChange]
  );

  const handleStartChange = React.useCallback(
    (value: string) => {
      setStartDate(value);
      emit(value, endDate);
    },
    [emit, endDate]
  );

  const handleEndChange = React.useCallback(
    (value: string) => {
      setEndDate(value);
      emit(startDate, value);
    },
    [emit, startDate]
  );

  const handleStartBlur = React.useCallback(() => {
    setStartTouched(true);
    onBlur?.(id, startDate);
  }, [id, startDate, onBlur]);

  const handleEndBlur = React.useCallback(() => {
    setEndTouched(true);
    onBlur?.(id, endDate);
  }, [id, endDate, onBlur]);

  const handleStartFocus = React.useCallback(() => {
    onFocus?.(id, startDate);
  }, [id, startDate, onFocus]);

  const handleEndFocus = React.useCallback(() => {
    onFocus?.(id, endDate);
  }, [id, endDate, onFocus]);

  const handleStartDatePick = React.useCallback(
    (formatted: string) => {
      setStartDate(formatted);
      emit(formatted, endDate);
    },
    [emit, endDate]
  );

  const handleEndDatePick = React.useCallback(
    (dateStr: string) => {
      setEndDate(dateStr);
      emit(startDate, dateStr);
    },
    [emit, startDate]
  );

  const startError =
    startTouched && startDate && !validateDate(startDate)
      ? "Invalid date format"
      : undefined;

  const endError =
    endTouched && endDate && !validateDate(endDate)
      ? "Invalid date format"
      : undefined;

  return {
    startDate,
    endDate,
    startPickerOpen,
    endPickerOpen,
    startTouched,
    endTouched,
    startError,
    endError,
    setStartPickerOpen,
    setEndPickerOpen,
    handleStartChange,
    handleEndChange,
    handleStartBlur,
    handleEndBlur,
    handleStartFocus,
    handleEndFocus,
    handleStartDatePick,
    handleEndDatePick,
    setStartTouched,
    setEndTouched
  };
}
