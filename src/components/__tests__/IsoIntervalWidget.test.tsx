import { MantineProvider } from "@mantine/core";
import type { WidgetProps } from "@rjsf/utils";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import IsoIntervalWidget from "../IsoIntervalWidget";

function renderWidget(over: Partial<WidgetProps> = {}) {
  const props = {
    id: "root_temporal_coverage",
    value: undefined,
    required: true,
    disabled: false,
    readonly: false,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    label: "Temporal Coverage",
    options: {},
    rawErrors: [],
    schema: { type: "string" as const },
    uiSchema: {},
    registry: { formContext: {}, fields: {}, widgets: {}, templates: {} },
    ...over,
  } as unknown as WidgetProps;

  return render(
    <MantineProvider>
      <IsoIntervalWidget {...props} />
    </MantineProvider>,
  );
}

/** Mantine points an invalid input at its message through aria-describedby. */
function errorTextFor(nth: number): string | null {
  const input = screen.getAllByPlaceholderText("YYYY-MM-DD")[nth];
  if (input.getAttribute("aria-invalid") !== "true") return null;
  const describedBy = input.getAttribute("aria-describedby");
  if (!describedBy) return null;
  for (const id of describedBy.split(" ")) {
    if (id.endsWith("-error")) return document.getElementById(id)?.textContent ?? null;
  }
  return null;
}

const START = 0;
const END = 1;

describe("IsoIntervalWidget", () => {
  describe("layout", () => {
    it("renders both date inputs", () => {
      renderWidget();
      expect(screen.getAllByPlaceholderText("YYYY-MM-DD")).toHaveLength(2);
    });

    it("marks the end date optional unless ui:options says otherwise", () => {
      renderWidget();
      expect(screen.getByText("End date (optional)")).toBeInTheDocument();
    });

    it("drops the optional wording when the end date is required", () => {
      renderWidget({ options: { endDateRequired: true } });
      expect(screen.getByText("End date")).toBeInTheDocument();
      expect(screen.queryByText("End date (optional)")).not.toBeInTheDocument();
    });

    it("accepts the vertical layout used by nested fields", () => {
      renderWidget({ options: { layout: "vertical" } });
      expect(screen.getAllByPlaceholderText("YYYY-MM-DD")).toHaveLength(2);
    });
  });

  describe("calendar-date strictness", () => {
    it("refuses an impossible date instead of normalising it", async () => {
      const onChange = vi.fn();
      renderWidget({ onChange });
      const start = screen.getAllByPlaceholderText("YYYY-MM-DD")[START];
      await userEvent.type(start, "2024-02-31");
      await userEvent.tab();
      expect(start).toHaveValue("");
      for (const [v] of onChange.mock.calls) expect(v).not.toMatch(/2024-02-3|2024-03-0/);
    });

    // A pattern-shaped but impossible stored date passes the schema's pattern
    // check while the input shows it as blank. The hook drops it so form data
    // never keeps a value the user cannot see.
    it("drops a stored impossible end date from the form data", async () => {
      const onChange = vi.fn();
      renderWidget({ value: "2024-01-01/2024-02-31", onChange });
      expect(screen.getAllByPlaceholderText("YYYY-MM-DD")[END]).toHaveValue("");
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(onChange).toHaveBeenLastCalledWith("2024-01-01/..");
    });

    // An interval has no meaning without a start, so an impossible start
    // clears the whole value rather than leaving a dangling end date.
    it("clears the interval when the stored start date is impossible", async () => {
      const onChange = vi.fn();
      renderWidget({ value: "2024-02-31/2024-12-31", onChange });
      expect(screen.getAllByPlaceholderText("YYYY-MM-DD")[START]).toHaveValue("");
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(onChange).toHaveBeenLastCalledWith(undefined);
    });

    // Viewing is not editing: a read-only widget must not rewrite the data.
    it("does not rewrite an impossible stored date while read-only", async () => {
      const onChange = vi.fn();
      renderWidget({ value: "2024-02-31/2024-12-31", onChange, readonly: true });
      await new Promise((r) => setTimeout(r, 20));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not rewrite an impossible stored date while disabled", async () => {
      const onChange = vi.fn();
      renderWidget({ value: "2024-01-01/2024-02-31", onChange, disabled: true });
      await new Promise((r) => setTimeout(r, 20));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("leaves a valid stored interval alone", async () => {
      const onChange = vi.fn();
      renderWidget({ value: "2024-01-01/2024-12-31", onChange });
      await new Promise((r) => setTimeout(r, 20));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("error attribution", () => {
    // One interval string covers both dates, so a schema error does not say
    // which half is wrong. Blaming the start date by default marks a perfectly
    // good value.
    it("puts the error on the start date when the start is missing", () => {
      renderWidget({ rawErrors: ["Field is required"] });
      expect(errorTextFor(START)).toBe("Field is required");
      expect(errorTextFor(END)).toBeNull();
    });

    // A malformed half cannot be typed any more, only imported. The input shows
    // it as empty, so the interval-level error goes to the start input.
    it("shows an imported malformed end as empty and puts the error on the start", () => {
      renderWidget({ value: "2024-01-01/20xx", rawErrors: ["Invalid date format"] });
      expect(screen.getAllByPlaceholderText("YYYY-MM-DD")[END]).toHaveValue("");
      expect(errorTextFor(START)).toBe("Invalid date format");
      expect(errorTextFor(END)).toBeNull();
    });

    it("puts the error on the start date when only the start is malformed", () => {
      renderWidget({ value: "20xx/2024-12-31", rawErrors: ["Invalid date format"] });
      expect(errorTextFor(START)).toBe("Invalid date format");
      expect(errorTextFor(END)).toBeNull();
    });

    it("falls back to the start date when neither half is malformed", () => {
      // e.g. an ordering rule: both dates parse, but end precedes start.
      renderWidget({
        value: "2024-12-31/2024-01-01",
        rawErrors: ["End date must be ≥ start date."],
      });
      expect(errorTextFor(START)).toBe("End date must be ≥ start date.");
    });

    it("marks only the end date when it is required and empty", () => {
      renderWidget({
        value: "2024-01-01/..",
        options: { endDateRequired: true },
        rawErrors: ["Field is required"],
      });
      expect(errorTextFor(END)).toBe("Field is required");
      expect(errorTextFor(START)).toBeNull();
    });

    it("marks only the start date when the end is required and present", () => {
      renderWidget({
        value: "20xx/2024-12-31",
        options: { endDateRequired: true },
        rawErrors: ["Invalid date format"],
      });
      expect(errorTextFor(START)).toBe("Invalid date format");
      expect(errorTextFor(END)).toBeNull();
    });

    it("marks both when the start is empty and a required end is missing", () => {
      renderWidget({
        value: "/..",
        options: { endDateRequired: true },
        rawErrors: ["Field is required"],
      });
      expect(errorTextFor(START)).toBe("Field is required");
      expect(errorTextFor(END)).toBe("Field is required");
    });

    it("leaves both inputs clean when there are no errors", () => {
      renderWidget({ value: "2024-01-01/2024-12-31" });
      expect(errorTextFor(START)).toBeNull();
      expect(errorTextFor(END)).toBeNull();
    });
  });
});
