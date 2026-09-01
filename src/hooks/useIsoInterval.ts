/**
 * useIsoInterval - Shared state for a widget backed by one ISO 8601 interval.
 *
 * Holds the two halves of `YYYY-MM-DD/YYYY-MM-DD` (or `/..` when open-ended)
 * and rebuilds the string on change. Typing-validation state lives in the
 * date inputs themselves now, so this is only parse, hold, emit.
 */
import * as React from "react";
import { buildInterval, parseInterval, validateDate } from "@/utils/dateUtils";

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
  /** Set one half; an empty string clears it. Emits the rebuilt interval. */
  setStart: (date: string) => void;
  setEnd: (date: string) => void;
  handleStartBlur: () => void;
  handleEndBlur: () => void;
  handleStartFocus: () => void;
  handleEndFocus: () => void;
}

export function useIsoInterval({
  id,
  value,
  onChange,
  onBlur,
  onFocus,
}: UseIsoIntervalProps): UseIsoIntervalReturn {
  // A half that matches the YYYY-MM-DD shape but is not a real date (an
  // imported 2024-02-31, say) would pass the schema's pattern check while the
  // input shows it as blank. It is dropped here so form data never keeps a
  // value the user cannot see.
  const { start, end } = React.useMemo(() => {
    const parsed = parseInterval(value);
    return {
      start: validateDate(parsed.start) ? parsed.start : "",
      end: validateDate(parsed.end) ? parsed.end : "",
    };
  }, [value]);

  const [startDate, setStartDate] = React.useState(start);
  const [endDate, setEndDate] = React.useState(end);
  React.useEffect(() => {
    setStartDate(start);
    setEndDate(end);
  }, [start, end]);

  const emit = React.useCallback(
    (s: string, e: string) => onChange(buildInterval(s, e) ?? undefined),
    [onChange],
  );

  React.useEffect(() => {
    const raw = parseInterval(value);
    if (raw.start !== start || raw.end !== end) emit(start, end);
  }, [value, start, end, emit]);

  const setStart = React.useCallback(
    (date: string) => {
      setStartDate(date);
      emit(date, endDate);
    },
    [emit, endDate],
  );

  const setEnd = React.useCallback(
    (date: string) => {
      setEndDate(date);
      emit(startDate, date);
    },
    [emit, startDate],
  );

  const handleStartBlur = React.useCallback(() => onBlur?.(id, startDate), [id, startDate, onBlur]);
  const handleEndBlur = React.useCallback(() => onBlur?.(id, endDate), [id, endDate, onBlur]);
  const handleStartFocus = React.useCallback(
    () => onFocus?.(id, startDate),
    [id, startDate, onFocus],
  );
  const handleEndFocus = React.useCallback(() => onFocus?.(id, endDate), [id, endDate, onFocus]);

  return {
    startDate,
    endDate,
    setStart,
    setEnd,
    handleStartBlur,
    handleEndBlur,
    handleStartFocus,
    handleEndFocus,
  };
}
