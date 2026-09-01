import { MantineProvider } from "@mantine/core";
import type { WidgetProps } from "@rjsf/utils";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { theme } from "@/theme";
import DateWidget from "../DateWidget";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function renderWidget(over: Partial<WidgetProps> = {}) {
  const onChange = vi.fn();
  const props = {
    id: "root_data_access_date",
    name: "data_access_date",
    label: "Data Access Date",
    value: undefined,
    required: false,
    disabled: false,
    readonly: false,
    autofocus: false,
    options: {},
    schema: { type: "string" as const, format: "date", description: "When the data opens." },
    uiSchema: {},
    rawErrors: [],
    onChange,
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    registry: { formContext: {}, fields: {}, widgets: {}, templates: {} },
    ...over,
  } as unknown as WidgetProps;

  // The app theme carries the DateInput defaults (weekendDays, clearable).
  render(
    <MantineProvider theme={theme}>
      <DateWidget {...props} />
    </MantineProvider>,
  );
  return { onChange };
}

describe("DateWidget", () => {
  it("renders a stored date", () => {
    renderWidget({ value: "2027-06-01" });
    expect(screen.getByRole("textbox")).toHaveValue("2027-06-01");
  });

  it("emits the ISO date when a valid one is typed", async () => {
    const { onChange } = renderWidget();
    await userEvent.type(screen.getByRole("textbox"), "2027-06-01");
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith("2027-06-01");
  });

  // The stock widget emitted "" here, which fails `format: date` and left an
  // open-access dataset invalid even after the user removed the bad value.
  it("drops the value rather than emitting an empty string when cleared", async () => {
    const { onChange } = renderWidget({ value: "2027-06-01" });
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.tab();
    const emitted = onChange.mock.calls.map(([v]) => v);
    expect(emitted).toContain(undefined);
    expect(emitted).not.toContain("");
  });

  it("never emits a malformed value", async () => {
    const { onChange } = renderWidget();
    await userEvent.type(screen.getByRole("textbox"), "not a date");
    await userEvent.tab();
    for (const [v] of onChange.mock.calls) {
      expect(v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v)).toBe(true);
    }
  });

  it("renders its label and opens the description in a modal", async () => {
    renderWidget({ uiSchema: { "ui:descriptionModal": true } });
    expect(screen.getByText("Data Access Date")).toBeInTheDocument();

    // The description only exists behind the info control; opening it is the
    // proof that this widget wires FieldLabel up like the other custom ones.
    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("When the data opens.")).toBeInTheDocument();
  });

  it("surfaces validation errors on the input", () => {
    renderWidget({
      rawErrors: ["Either a data access link (DOI) or a data access date must be provided."],
    });
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});
