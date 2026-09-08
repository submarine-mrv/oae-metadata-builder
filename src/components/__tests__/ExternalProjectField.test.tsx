import { MantineProvider } from "@mantine/core";
import type { ErrorSchema, FieldProps } from "@rjsf/utils";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ExternalProjectField from "../ExternalProjectField";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const schema = {
  type: "object" as const,
  required: ["temporal_coverage", "spatial_coverage", "name"],
  properties: {
    name: { type: "string" as const, title: "Name" },
    description: { type: "string" as const, title: "Description" },
    temporal_coverage: { type: "string" as const, title: "Temporal Coverage" },
    spatial_coverage: { type: "object" as const, title: "Spatial Coverage", properties: {} },
    related_links: { type: "array" as const, title: "Related Links", items: { type: "string" } },
  },
};

/** Per-field error lists, in the shape RJSF builds for a nested object field. */
type FieldErrors = Record<string, unknown>;

function renderField(errors: FieldErrors = {}, formData: Record<string, unknown> = {}) {
  const props = {
    schema,
    uiSchema: {},
    formData,
    errorSchema: errors as unknown as ErrorSchema,
    idSchema: { $id: "root_prev" },
    fieldPathId: { $id: "root_prev", path: ["prev"] },
    name: "prev",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    registry: { formContext: {}, fields: {}, widgets: {}, templates: {} },
  } as unknown as FieldProps;

  return render(
    <MantineProvider>
      <ExternalProjectField {...props} />
    </MantineProvider>,
  );
}

/**
 * Mantine points an invalid input at its message through aria-describedby.
 * `nth` picks between inputs sharing a placeholder — the two date fields both
 * use "YYYY-MM-DD", start first.
 */
function errorTextFor(placeholder: string, nth = 0): string | null {
  const input = screen.getAllByPlaceholderText(placeholder)[nth];
  if (input.getAttribute("aria-invalid") !== "true") return null;
  const describedBy = input.getAttribute("aria-describedby");
  if (!describedBy) return null;
  for (const id of describedBy.split(" ")) {
    if (id.endsWith("-error")) return document.getElementById(id)?.textContent ?? null;
  }
  return null;
}

describe("ExternalProjectField", () => {
  describe("widget onChange adapter", () => {
    // Clearing a date emits `undefined`. Reading `.formData` off it threw, the
    // update never landed, and the field kept its stale value and error.
    it("does not throw when a widget clears its value", async () => {
      const onChange = vi.fn();
      const props = {
        schema,
        uiSchema: {},
        formData: { temporal_coverage: "2024-01-01/.." },
        errorSchema: {},
        idSchema: { $id: "root_prev" },
        fieldPathId: { $id: "root_prev", path: ["prev"] },
        name: "prev",
        onChange,
        onBlur: vi.fn(),
        onFocus: vi.fn(),
        registry: { formContext: {}, fields: {}, widgets: {}, templates: {} },
      } as unknown as FieldProps;

      render(
        <MantineProvider>
          <ExternalProjectField {...props} />
        </MantineProvider>,
      );

      const start = screen.getAllByPlaceholderText("YYYY-MM-DD")[0];
      await userEvent.clear(start);
      await userEvent.tab();

      expect(onChange).toHaveBeenCalled();
      const [updated] = onChange.mock.calls.at(-1) ?? [];
      expect(updated?.temporal_coverage).toBeUndefined();
    });
  });

  describe("required markers", () => {
    it("marks name as required", () => {
      renderField();
      const nameLabel = screen.getByText("Name").closest("*");
      expect(nameLabel?.textContent).toContain("*");
    });

    it("does not mark optional fields as required", () => {
      renderField();
      const descriptionLabel = screen.getByText("Description").parentElement;
      expect(descriptionLabel?.textContent).not.toContain("*");
    });
  });

  it("labels nested fields from the schema title, not the slug", () => {
    renderField();
    expect(screen.getByText("Temporal Coverage")).toBeInTheDocument();
    expect(screen.queryByText("temporal_coverage")).not.toBeInTheDocument();
  });

  describe("validation errors", () => {
    // Regression: both prop builders hard-coded `rawErrors: []` and the two
    // Mantine inputs rendered here had no error prop, so the summary box listed
    // errors that no input ever showed.
    it("shows an error under the name input", () => {
      renderField({ name: { __errors: ["Field is required"] } });
      expect(errorTextFor("Project name")).toBe("Field is required");
    });

    it("shows an error under the description input", () => {
      renderField({ description: { __errors: ["Too long"] } });
      expect(errorTextFor("Project description")).toBe("Too long");
    });

    it("joins multiple errors for one field", () => {
      renderField({ name: { __errors: ["Field is required", "Must be a string"] } });
      expect(errorTextFor("Project name")).toBe("Field is required, Must be a string");
    });

    it("leaves inputs unmarked when there are no errors", () => {
      renderField();
      expect(errorTextFor("Project name")).toBeNull();
      expect(errorTextFor("Project description")).toBeNull();
    });

    it("marks only the field that has an error", () => {
      renderField({ name: { __errors: ["Field is required"] } });
      expect(errorTextFor("Project name")).toBe("Field is required");
      expect(errorTextFor("Project description")).toBeNull();
    });

    // The stacked variant previously took rawErrors but only used them to change
    // timing, so a missing start date stayed unmarked.
    it("shows an error on the temporal coverage start date", () => {
      renderField({ temporal_coverage: { __errors: ["Field is required"] } });
      expect(errorTextFor("YYYY-MM-DD")).toBe("Field is required");
    });

    // The raw AJV message reached the user before the transform matched nested
    // properties. Only "Field is required" and "Invalid date format" belong here.
    it("never shows a raw pattern regex on the start date", () => {
      renderField({ temporal_coverage: { __errors: ["Invalid date format"] } });
      const message = errorTextFor("YYYY-MM-DD");
      expect(message).toBe("Invalid date format");
      expect(message).not.toContain("must match pattern");
    });

    it("leaves the start date unmarked when temporal coverage is valid", () => {
      renderField();
      expect(errorTextFor("YYYY-MM-DD")).toBeNull();
    });

    // Errors can sit below the sub-field — spatial_coverage.geo.box, or a
    // related_links item — and still belong on the input that renders it.
    it("surfaces an error nested under a custom object field", () => {
      renderField({
        spatial_coverage: { geo: { box: { __errors: ["Must be four numbers"] } } },
      });
      expect(screen.getByText(/Must be four numbers/)).toBeInTheDocument();
      expect(screen.queryByText(/Spatial Coverage is required/)).not.toBeInTheDocument();
    });

    it("surfaces an error nested under an array item", () => {
      renderField({
        related_links: { 0: { __errors: ["Must be a valid URL"] } },
      });
      expect(screen.getByText("Must be a valid URL")).toBeInTheDocument();
    });

    it("de-duplicates the same message repeated down the subtree", () => {
      renderField({
        name: { __errors: ["Field is required"], nested: { __errors: ["Field is required"] } },
      });
      expect(errorTextFor("Project name")).toBe("Field is required");
    });

    it("survives an absent errorSchema", () => {
      const props = {
        schema,
        uiSchema: {},
        formData: {},
        idSchema: { $id: "root_prev" },
        fieldPathId: { $id: "root_prev", path: ["prev"] },
        name: "prev",
        onChange: vi.fn(),
        onBlur: vi.fn(),
        onFocus: vi.fn(),
        registry: { formContext: {}, fields: {}, widgets: {}, templates: {} },
      } as unknown as FieldProps;

      expect(() =>
        render(
          <MantineProvider>
            <ExternalProjectField {...props} />
          </MantineProvider>,
        ),
      ).not.toThrow();
    });
  });
});
