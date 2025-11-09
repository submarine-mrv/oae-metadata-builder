import React from "react";
import { Popover, ActionIcon } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import dayjs from "dayjs";

const parseToDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  // Use dayjs without strict parsing to be more flexible
  const d = dayjs(dateStr);
  return d.isValid() ? d.toDate() : null;
};

const formatFromDate = (date: Date | null): string => {
  if (!date) return "";
  return dayjs(date).format("YYYY-MM-DD");
};

interface DatePickerPopoverProps {
  opened: boolean;
  onChange: (opened: boolean) => void;
  value: string;
  onDateChange: (formatted: string) => void;
  onTouched: () => void;
  disabled?: boolean;
  readonly?: boolean;
}

const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  opened,
  onChange,
  value,
  onDateChange,
  onTouched,
  disabled,
  readonly
}) => (
  <Popover
    opened={opened}
    onChange={onChange}
    position="bottom-end"
    withinPortal={true}
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
        value={parseToDate(value)}
        onChange={(dateStr: string | null) => {
          onDateChange(dateStr || "");
          onTouched();
          onChange(false);
        }}
        weekendDays={[]}
      />
    </Popover.Dropdown>
  </Popover>
);

export default DatePickerPopover;
