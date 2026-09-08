import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UnitsField from "../UnitsField";

const ROOT_SCHEMA = {
  $defs: {
    Var: {
      type: "object",
      required: ["units"],
      properties: {
        units: { type: "string", title: "Unit", description: "Unit of measurement." },
      },
    },
  },
};

const VAR_SCHEMA = ROOT_SCHEMA.$defs.Var;

function renderUnits(
  formData: Record<string, unknown>,
  onChange: (d: Record<string, unknown>) => void,
  suggestions: string[] = [],
) {
  return render(
    <MantineProvider>
      <UnitsField
        fieldPath="units"
        variableSchema={VAR_SCHEMA}
        rootSchema={ROOT_SCHEMA}
        formData={formData}
        onChange={onChange}
        suggestions={suggestions}
      />
    </MantineProvider>,
  );
}

describe("UnitsField", () => {
  it("writes arbitrary typed text straight into units", () => {
    const onChange = vi.fn();
    renderUnits({}, onChange, ["Pa", "uatm"]);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "µmol kg-1" } });

    const next = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(next.units).toBe("µmol kg-1");
  });

  it("never creates a _custom sibling for an off-list unit", () => {
    const onChange = vi.fn();
    renderUnits({}, onChange, ["Pa"]);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "not a real unit" } });

    const next = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(next)).toEqual(["units"]);
    expect(next).not.toHaveProperty("units_custom");
  });

  it("emits undefined when cleared, matching SchemaField", () => {
    const onChange = vi.fn();
    renderUnits({ units: "Pa" }, onChange, ["Pa"]);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });

    const next = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(next.units).toBeUndefined();
  });

  it("shows the stored value", () => {
    renderUnits({ units: "mol kg-1" }, vi.fn(), ["mol kg-1"]);
    expect(screen.getByRole("textbox")).toHaveValue("mol kg-1");
  });

  it("says the list is only a suggestion when a CF name is selected", () => {
    renderUnits({}, vi.fn(), ["uatm", "Pa"]);
    expect(screen.getByText(/Any other unit can be typed/)).toBeInTheDocument();
  });

  it("says nothing about suggestions when there are none", () => {
    renderUnits({}, vi.fn(), []);
    expect(screen.queryByText(/Any other unit can be typed/)).not.toBeInTheDocument();
  });
});
