import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SchemaField from "../SchemaField";

// Minimal schema stubs — enough for SchemaField to resolve metadata
const ROOT_SCHEMA = {
  $defs: {
    SimpleVar: {
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
        notes: { type: "string", title: "Notes" },
        count: { type: "number", title: "Count" },
      },
    },
  },
};

const VAR_SCHEMA = ROOT_SCHEMA.$defs.SimpleVar;

function renderField(
  fieldPath: string,
  formData: Record<string, unknown>,
  onChange: (d: Record<string, unknown>) => void,
  inputType: "text" | "textarea" = "text",
) {
  return render(
    <MantineProvider>
      <SchemaField
        fieldPath={fieldPath}
        variableSchema={VAR_SCHEMA}
        rootSchema={ROOT_SCHEMA}
        formData={formData}
        onChange={onChange}
        inputType={inputType}
      />
    </MantineProvider>,
  );
}

describe("SchemaField — empty-string → undefined convention", () => {
  it("emits undefined (not '') when a TextInput is cleared", () => {
    const onChange = vi.fn();
    renderField("name", { name: "salinity" }, onChange);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledOnce();
    const newData = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(newData.name).toBeUndefined();
  });

  it("emits the typed value when a TextInput has content", () => {
    const onChange = vi.fn();
    renderField("name", { name: "" }, onChange);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "salinity" } });

    const newData = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(newData.name).toBe("salinity");
  });

  it("emits undefined (not '') when a Textarea is cleared", () => {
    const onChange = vi.fn();
    renderField("notes", { notes: "some text" }, onChange, "textarea");

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "" } });

    const newData = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(newData.notes).toBeUndefined();
  });

  it("emits the typed value when a Textarea has content", () => {
    const onChange = vi.fn();
    renderField("notes", { notes: "" }, onChange, "textarea");

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "some notes" } });

    const newData = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(newData.notes).toBe("some notes");
  });
});
