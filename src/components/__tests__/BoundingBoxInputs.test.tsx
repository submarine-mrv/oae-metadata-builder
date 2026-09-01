import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { formatBoundsString, parseBoundsString } from "@/utils/mapLayerUtils";
import { validateSpatialBounds } from "@/utils/spatialUtils";
import BoundingBoxInputs from "../BoundingBoxInputs";

function renderInputs(over: Partial<React.ComponentProps<typeof BoundingBoxInputs>> = {}) {
  const onChange = vi.fn();
  render(
    <MantineProvider>
      <BoundingBoxInputs north="" south="" east="" west="" onChange={onChange} {...over} />
    </MantineProvider>,
  );
  return { onChange };
}

describe("BoundingBoxInputs", () => {
  it("labels each input by edge for assistive tech", () => {
    renderInputs();
    for (const name of ["North edge", "South edge", "East edge", "West edge"]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it("shows the compass letters beside the inputs", () => {
    renderInputs();
    for (const letter of ["N:", "S:", "E:", "W:"]) {
      expect(screen.getByText(letter)).toBeInTheDocument();
    }
  });

  it("hints each edge with its extreme value", () => {
    renderInputs();
    expect(screen.getByLabelText("North edge")).toHaveAttribute("placeholder", "90");
    expect(screen.getByLabelText("South edge")).toHaveAttribute("placeholder", "-90");
    expect(screen.getByLabelText("East edge")).toHaveAttribute("placeholder", "180");
    expect(screen.getByLabelText("West edge")).toHaveAttribute("placeholder", "-180");
  });

  it("reports which edge changed", async () => {
    const { onChange } = renderInputs();
    await userEvent.type(screen.getByLabelText("North edge"), "42");
    expect(onChange).toHaveBeenLastCalledWith("north", 42);
  });

  // A box across the antimeridian has west > east (170 to -170). Both values sit
  // inside the longitude range, so the inputs must pass them through unchanged;
  // the -180/180 placeholders are hints, not a constraint against crossing.
  it("accepts an antimeridian-crossing box without clamping either edge", async () => {
    const { onChange } = renderInputs();
    await userEvent.type(screen.getByLabelText("West edge"), "170");
    await userEvent.type(screen.getByLabelText("East edge"), "-170");

    const west = onChange.mock.calls.filter(([e]) => e === "west").at(-1)?.[1];
    const east = onChange.mock.calls.filter(([e]) => e === "east").at(-1)?.[1];
    expect(west).toBe(170);
    expect(east).toBe(-170);

    // And the rest of the pipeline still treats that pair as a valid crossing box.
    const bounds = formatBoundsString(170, -10, -170, 10);
    expect(validateSpatialBounds(bounds)).toBeNull();
    expect(parseBoundsString(bounds)).toEqual({ west: 170, south: -10, east: -170, north: 10 });
  });

  it("marks only the latitude inputs when the latitude order is wrong", () => {
    renderInputs({ latitudeError: true });
    expect(screen.getByLabelText("North edge")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("South edge")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("East edge")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/North latitude must be greater/)).toBeInTheDocument();
  });
});
