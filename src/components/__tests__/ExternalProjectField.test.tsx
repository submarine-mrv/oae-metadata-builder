import { MantineProvider } from "@mantine/core";
import type { ErrorSchema, FieldProps } from "@rjsf/utils";
import { render, screen } from "@testing-library/react";
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
type FieldErrors = Record<string, { __errors: string[] }>;

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

    // IsoIntervalWidgetVertical previously took rawErrors but only used them to
    // change timing, so a missing start date stayed unmarked.
    it("shows an error on the temporal coverage start date", () => {
      renderField({ temporal_coverage: { __errors: ["Field is required"] } });
      expect(errorTextFor("YYYY-MM-DD")).toBe("Field is required");
    });

    it("leaves the start date unmarked when temporal coverage is valid", () => {
      renderField();
      expect(errorTextFor("YYYY-MM-DD")).toBeNull();
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
