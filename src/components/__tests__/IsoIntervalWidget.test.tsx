import { MantineProvider } from "@mantine/core";
import type { WidgetProps } from "@rjsf/utils";
import { render, screen } from "@testing-library/react";
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
