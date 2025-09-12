"use client";
import React from "react";
import type { WidgetProps } from "@rjsf/utils";
import {
  Combobox,
  Group,
  Pill,
  PillsInput,
  Text,
  useCombobox
} from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";

type EnumOption = { value: string; label: string };
const norm = (s: string) => (s || "").toLowerCase();

const SeaNamesAutocompleteWidget: React.FC<WidgetProps> = ({
  id,
  label,
  required,
  disabled,
  readonly,
  value,
  onChange,
  options = {}
}) => {
  const enumOptions: EnumOption[] =
    (options as any).enumOptions ??
    (options as any).oneOf?.map((o: any) => ({
      value: o.const,
      label: o.title ?? String(o.const)
    })) ??
    [];

  const maxWidth = (options as any).maxWidth ?? 520;
  const placeholder = (options as any).placeholder ?? "Search seas…";
  const creatable = Boolean((options as any).creatable); // default false

  const selected: string[] = Array.isArray(value) ? value : [];
  const [search, setSearch] = React.useState("");

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active")
  });

  const byValue = React.useMemo(
    () => new Map(enumOptions.map((o) => [o.value, o])),
    [enumOptions]
  );

  const filtered = React.useMemo(() => {
    const q = norm(search.trim());
    return enumOptions.filter(
      (o) => norm(o.label).includes(q) || norm(o.value).includes(q)
    );
  }, [enumOptions, search]);

  const exact = enumOptions.some(
    (o) => norm(o.label) === norm(search) || norm(o.value) === norm(search)
  );

  const commit = (next: string[]) => onChange(Array.from(new Set(next)));

  const handleSelect = (val: string) => {
    setSearch("");
    if (val === "$create") {
      if (creatable && search.trim()) commit([...selected, search.trim()]);
      return;
    }
    commit(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };

  const handleRemove = (val: string) =>
    commit(selected.filter((v) => v !== val));

  const optionNodes = filtered.map((o) => (
    <Combobox.Option
      value={o.value}
      key={o.value}
      active={selected.includes(o.value)}
    >
      <Group gap="xs" wrap="nowrap">
        {selected.includes(o.value) ? (
          <IconCheck size={14} />
        ) : (
          <span style={{ width: 14 }} />
        )}
        <Text lineClamp={1}>{o.label}</Text>
      </Group>
    </Combobox.Option>
  ));

  return (
    <div id={id} style={{ maxWidth }}>
      {label && (
        <Text size="sm" fw={500} mb="xs">
          {label} {required && <Text component="span" c="red">*</Text>}
        </Text>
      )}

      <Combobox
        store={combobox}
        onOptionSubmit={handleSelect}
        withinPortal={false}
        disabled={disabled || readonly}
      >
        <Combobox.DropdownTarget>
          <PillsInput onClick={() => combobox.openDropdown()}>
            <Pill.Group>
              {selected.map((v) => (
                <Pill
                  key={v}
                  withRemoveButton
                  onRemove={() => !disabled && !readonly && handleRemove(v)}
                >
                  {byValue.get(v)?.label ?? v}
                </Pill>
              ))}

              <Combobox.EventsTarget>
                <PillsInput.Field
                  placeholder={placeholder}
                  value={search}
                  onFocus={() => combobox.openDropdown()}
                  onBlur={() => combobox.closeDropdown()}
                  onChange={(e) => {
                    combobox.updateSelectedOptionIndex();
                    setSearch(e.currentTarget.value);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Backspace" &&
                      search.length === 0 &&
                      selected.length > 0
                    ) {
                      e.preventDefault();
                      handleRemove(selected[selected.length - 1]);
                    }
                  }}
                  disabled={disabled || readonly}
                />
              </Combobox.EventsTarget>
            </Pill.Group>
          </PillsInput>
        </Combobox.DropdownTarget>

        {filtered.length <= 50 ? (
          <Combobox.Dropdown>
            <Combobox.Options>
              {optionNodes}

              {creatable && !exact && search.trim().length > 0 && (
                <Combobox.Option value="$create">
                  + Create {search}
                </Combobox.Option>
              )}

              {search.trim().length > 0 && optionNodes.length === 0 && (
                <Combobox.Empty>
                  Nothing found.{" "}
                  <a
                    href="https://vocab.nerc.ac.uk/collection/C16/current/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--mantine-color-blue-6)",
                      textDecoration: "underline"
                    }}
                  >
                    View all sea names
                  </a>
                </Combobox.Empty>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        ) : (
          <></>
          //   <Combobox.Empty>
          //     {filtered.length} results found. Keep typing to narrow down...
          //   </Combobox.Empty>
        )}
      </Combobox>

      {selected.length > 0 && !disabled && !readonly && (
        <button
          type="button"
          onClick={() => commit([])}
          style={{
            marginTop: 8,
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            fontSize: 12,
            opacity: 0.8
          }}
        >
          <IconX size={14} />
          Clear all
        </button>
      )}
    </div>
  );
};

export default SeaNamesAutocompleteWidget;
