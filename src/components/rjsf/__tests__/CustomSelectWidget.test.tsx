import { MantineProvider } from "@mantine/core";
import type { WidgetProps } from "@rjsf/utils";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import CustomSelectWidget from "../CustomSelectWidget";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const enumOptions = [
  { value: "open_access", label: "Open Access" },
  { value: "conditional_access", label: "Conditional Access" },
];

const NOTICE = "Open access datasets need either a data access link or a data access date.";

function renderSelect(over: Partial<WidgetProps> = {}) {
  const props = {
    id: "root_data_accessibility",
    name: "data_accessibility",
    label: "Data Accessibility",
    value: undefined,
    required: true,
    disabled: false,
    readonly: false,
    autofocus: false,
    multiple: false,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    options: { enumOptions },
    schema: { type: "string" as const, enum: enumOptions.map((o) => o.value) },
    uiSchema: { "ui:valueNotice": { open_access: NOTICE } },
    rawErrors: [],
    registry: { formContext: {}, fields: {}, widgets: {}, templates: {} },
    ...over,
  } as unknown as WidgetProps;

  return render(
    <MantineProvider>
      <CustomSelectWidget {...props} />
    </MantineProvider>,
  );
}

describe("CustomSelectWidget ui:valueNotice", () => {
  it("shows the notice while the matching value is selected", () => {
    renderSelect({ value: "open_access" });
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("shows nothing for a value without a notice", () => {
    renderSelect({ value: "conditional_access" });
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("shows nothing before a value is chosen", () => {
    renderSelect();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("shows nothing when no notices are configured", () => {
    renderSelect({ value: "open_access", uiSchema: {} });
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("is informational, not an error", () => {
    renderSelect({ value: "open_access" });
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });
});
