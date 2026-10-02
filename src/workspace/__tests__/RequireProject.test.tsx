import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireProject from "../RequireProject";
import { useWorkspace, WorkspaceProvider } from "../WorkspaceContext";

const navigateSpy = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Navigate: (props: { to: string }) => {
    navigateSpy(props.to);
    return null;
  },
}));

function Creator() {
  const { createProject } = useWorkspace();
  return (
    <button type="button" onClick={() => createProject()}>
      create
    </button>
  );
}

describe("RequireProject", () => {
  beforeEach(() => {
    localStorage.clear();
    navigateSpy.mockClear();
  });

  it("redirects to the overview when the workspace is empty, and renders children once a project exists", () => {
    render(
      <WorkspaceProvider>
        <Creator />
        <RequireProject>
          <p>form</p>
        </RequireProject>
      </WorkspaceProvider>,
    );
    expect(navigateSpy).toHaveBeenCalledWith("/overview");
    expect(screen.queryByText("form")).toBeNull();

    act(() => screen.getByText("create").click());
    expect(screen.getByText("form")).toBeInTheDocument();
  });
});
