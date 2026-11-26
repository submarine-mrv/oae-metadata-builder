import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import schema from "@/schema/schema.bundled.json";
import LockableIdWidget from "../LockableIdWidget";

vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ user: null }) }));

const idSchema = schema.$defs.Project.properties.project_id;

function Harness({ initial, onBlur = vi.fn() }: { initial?: string; onBlur?: () => void }) {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <MantineProvider>
      <LockableIdWidget
        {...({} as any)}
        id="project_id"
        name="project_id"
        label="Project ID"
        value={value}
        onChange={setValue}
        onBlur={onBlur}
        onFocus={vi.fn()}
        schema={idSchema}
        uiSchema={{}}
        rawErrors={[]}
        options={{}}
        registry={{} as any}
      />
      <button type="button">elsewhere</button>
    </MantineProvider>
  );
}

const input = () => screen.getByRole("textbox") as HTMLInputElement;

describe("LockableIdWidget", () => {
  it("locks a valid ID on blur", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "PROJ-01");
    await user.click(screen.getByText("elsewhere"));
    expect(input().value).toBe("PROJ-01");
    expect(input().readOnly).toBe(true);
  });

  it("restores the previous ID when the edited one is invalid", async () => {
    const user = userEvent.setup();
    render(<Harness initial="PROJ-01" />);
    await user.click(screen.getByLabelText("Click to edit"));
    await user.type(input(), " bad");
    await user.click(screen.getByText("elsewhere"));
    expect(input().value).toBe("PROJ-01");
    expect(input().readOnly).toBe(true);
  });

  it("clears a new invalid ID", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "has space");
    await user.click(screen.getByText("elsewhere"));
    expect(input().value).toBe("");
  });

  it("leaves an invalid ID it was given editable instead of clearing it", async () => {
    const user = userEvent.setup();
    render(<Harness initial="old id" />);
    expect(input().readOnly).toBe(false);
    await user.click(input());
    await user.click(screen.getByText("elsewhere"));
    expect(input().value).toBe("old id");
    expect(input().readOnly).toBe(false);
  });
});
