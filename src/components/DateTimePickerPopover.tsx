import React from "react";
import { Popover, ActionIcon, Group, Divider } from "@mantine/core";
import { DatePicker, TimePicker } from "@mantine/dates";
import type { DateValue } from "@mantine/dates";
import { IconCalendar, IconCheck } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { DATETIME_FORMAT } from "@/utils/dateUtils";

dayjs.extend(utc);

/**
 * DateTimePickerPopover - Visual date/time picker in a popover
 *
 * All times are treated as UTC throughout - no timezone conversions.
 */

interface DateTimePickerPopoverProps {
  opened: boolean;
  onChange: (opened: boolean) => void;
  value: string; // "YYYY-MM-DD HH:mm:ss" UTC
  onDateTimeChange: (formatted: string) => void;
  disabled?: boolean;
  readonly?: boolean;
}

const DateTimePickerPopover: React.FC<DateTimePickerPopoverProps> = ({
  opened,
  onChange,
  value,
  onDateTimeChange,
  disabled,
  readonly
}) => {
  const [selectedDate, setSelectedDate] = React.useState<DateValue>(null);
  const [timeValue, setTimeValue] = React.useState<string>("00:00:00");
  const [currentLevel, setCurrentLevel] = React.useState<"month" | "year" | "decade">("month");
  const [displayedMonth, setDisplayedMonth] = React.useState<DateValue>(null);

  // Initialize from text field value when popover opens
  React.useEffect(() => {
    if (opened) {
      // Parse the current text field value
      const parsed = value ? dayjs.utc(value, DATETIME_FORMAT, true) : null;
      if (parsed?.isValid()) {
        const dateObj = new Date(parsed.year(), parsed.month(), parsed.date());
        setSelectedDate(dateObj);
        setDisplayedMonth(dateObj); // Start on the selected date's month
        setTimeValue(parsed.format("HH:mm:ss"));
      } else {
        setSelectedDate(null);
        setDisplayedMonth(null); // Let DatePicker use default (current month)
        setTimeValue("00:00:00");
      }
    }
  }, [opened, value]);

  /**
   * Handle date selection from DatePicker
   * Note: Mantine's DatePicker onChange can return Date | null or string depending on configuration
   */
  const handleDateChange = (date: DateValue | string) => {
    if (date === null) {
      setSelectedDate(null);
    } else if (typeof date === 'string') {
      // Handle string input: parse and convert to Date
      const parsed = dayjs.utc(date, 'YYYY-MM-DD', true);
      if (parsed.isValid()) {
        setSelectedDate(new Date(parsed.year(), parsed.month(), parsed.date()));
      } else {
        setSelectedDate(null);
      }
    } else if (date instanceof Date) {
      setSelectedDate(date);
    } else {
      setSelectedDate(null);
    }
  };

  const handleTimeChange = (time: string) => {
    setTimeValue(time);
  };

  /**
   * Handle month navigation in DatePicker
   * Note: Mantine's DatePicker onDateChange prop expects (date: string) => void
   */
  const handleDisplayedMonthChange = (date: string) => {
    const parsed = dayjs.utc(date, 'YYYY-MM-DD', true);
    if (parsed.isValid()) {
      setDisplayedMonth(new Date(parsed.year(), parsed.month(), parsed.date()));
    }
  };

  /**
   * Format and submit the selected date/time
   * Uses defensive type checking to ensure selectedDate is a valid Date instance
   */
  const handleSubmit = () => {
    // Handle null/undefined case
    if (!selectedDate) {
      onDateTimeChange("");
      return;
    }

    // Type guard: ensure it's actually a Date instance
    if (!(selectedDate instanceof Date) || typeof selectedDate.getFullYear !== 'function') {
      onDateTimeChange("");
      return;
    }

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day} ${timeValue}`;

    onDateTimeChange(formatted);
  };

  const handlePopoverClose = (isOpen: boolean) => {
    // When closing, save the current date/time
    if (!isOpen && opened) {
      handleSubmit();
    }
    onChange(isOpen);
  };

  return (
    <Popover
      opened={opened}
      onChange={handlePopoverClose}
      position="bottom-end"
      withinPortal={true}
      closeOnClickOutside={true}
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
          date={displayedMonth ?? undefined}
          onDateChange={handleDisplayedMonthChange}
          weekendDays={[]}
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
                value={timeValue}
                onChange={handleTimeChange}
                withSeconds
                size="sm"
                style={{
                  flex: 1,
                  marginInlineEnd: '12px'
                }}
              />
              <ActionIcon
                variant="default"
                size="input-sm"
                onClick={() => {
                  handleSubmit();
                  onChange(false);
                }}
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
