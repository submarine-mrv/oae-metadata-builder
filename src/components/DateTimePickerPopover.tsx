import React from "react";
import { Popover, ActionIcon, Stack, Group, Divider } from "@mantine/core";
import { DatePicker, TimePicker } from "@mantine/dates";
import { IconCalendar, IconCheck } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

// Format constants
const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const TIME_FORMAT = "HH:mm:ss";

/**
 * DateTimePickerPopover - A popover component for selecting date and time
 *
 * Features:
 * - Visual date selection via calendar
 * - Time input with HH:mm:ss format (spin inputs)
 * - Auto-focus to time picker after date selection
 * - Enter key submits the selection
 * - Check button to confirm and close
 *
 * @param opened - Controls popover visibility
 * @param onChange - Callback when popover open state changes
 * @param value - Current datetime value in "YYYY-MM-DD HH:mm:ss" format
 * @param onDateTimeChange - Callback when datetime changes (receives formatted string)
 * @param onTouched - Callback when user interacts with the component
 * @param disabled - Disables the calendar button
 * @param readonly - Makes the component read-only
 */

const parseToDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const d = dayjs.utc(dateStr, DATETIME_FORMAT, true);
  if (!d.isValid()) return null;

  // Create a "fake local" Date that displays UTC values
  // This is what Mantine's DatePicker expects
  return new Date(d.year(), d.month(), d.date(), d.hour(), d.minute(), d.second());
};

const parseToTime = (dateStr: string): string => {
  if (!dateStr) return "";
  // Parse as UTC since user enters UTC time
  const d = dayjs.utc(dateStr, DATETIME_FORMAT, true);
  return d.isValid() ? d.format(TIME_FORMAT) : "";
};

interface DateTimePickerPopoverProps {
  opened: boolean;
  onChange: (opened: boolean) => void;
  value: string;
  onDateTimeChange: (formatted: string) => void;
  onTouched: () => void;
  disabled?: boolean;
  readonly?: boolean;
}

const DateTimePickerPopover: React.FC<DateTimePickerPopoverProps> = ({
  opened,
  onChange,
  value,
  onDateTimeChange,
  onTouched,
  disabled,
  readonly
}) => {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(
    parseToDate(value)
  );
  const [timeValue, setTimeValue] = React.useState<string>(
    parseToTime(value) || "00:00:00"
  );
  const [currentLevel, setCurrentLevel] = React.useState<"month" | "year" | "decade">("month");
  const timePickerRef = React.useRef<HTMLDivElement>(null);

  // Update local state when value prop changes
  React.useEffect(() => {
    setSelectedDate(parseToDate(value));
    setTimeValue(parseToTime(value) || "00:00:00");
  }, [value]);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    // Focus time picker after date selection
    if (date) {
      setTimeout(() => {
        const hoursInput = timePickerRef.current?.querySelector(
          'input[aria-label="Hours"]'
        ) as HTMLInputElement;
        hoursInput?.focus();
      }, 0);
    }
  };

  const handleTimeChange = (time: string) => {
    setTimeValue(time);
  };

  const handleSubmit = () => {
    if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      onDateTimeChange("");
      onTouched();
      onChange(false);
      return;
    }

    // Extract date components treating the Date object values as UTC
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Combine date and time strings
    const formatted = `${dateStr} ${timeValue}`;

    // Validate the combined datetime
    const isValid = dayjs.utc(formatted, DATETIME_FORMAT, true).isValid();
    if (!isValid) {
      // Close and let the text input show the error
      onDateTimeChange(formatted);
      onTouched();
      onChange(false);
      return;
    }

    onDateTimeChange(formatted);
    onTouched();
    onChange(false);
  };

  const handleTimeKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={onChange}
      position="bottom-end"
      withinPortal={false}
      closeOnClickOutside={false}
      closeOnEscape={true}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={() => onChange(!opened)}
          disabled={disabled || readonly}
        >
          <IconCalendar size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <DatePicker
          value={selectedDate}
          onChange={handleDateChange}
          onLevelChange={setCurrentLevel}
          weekendDays={[]} // Remove weekend styling - all days are selectable
          size="sm"
        />
        {currentLevel === "month" && (
          <>
            <Divider my="sm" />
            <Group
              gap={0}
              wrap="nowrap"
              justify="space-between"
              style={{
                display: 'flex',
                alignItems: 'stretch'
              }}
            >
            <TimePicker
              ref={timePickerRef}
              value={timeValue}
              onChange={handleTimeChange}
              withSeconds
              size="sm"
              onKeyDown={handleTimeKeyDown}
              style={{
                flex: 1,
                marginInlineEnd: '12px'
              }}
            />
            <ActionIcon
              variant="default"
              size="input-sm"
              onClick={handleSubmit}
              aria-label="Submit datetime"
            >
              <IconCheck style={{ width: '30%', height: '30%' }} />
            </ActionIcon>
          </Group>
          </>
        )}
      </Popover.Dropdown>
    </Popover>
  );
};

export default DateTimePickerPopover;
