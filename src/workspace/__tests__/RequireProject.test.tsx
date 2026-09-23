import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectAtom } from "@/state/actions";
import { createTestStore, StoreWrapper } from "@/state/testing";
import RequireProject from "../RequireProject";

const navigateSpy = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Navigate: (props: { to: string }) => {
    navigateSpy(props.to);
    return null;
  },
}));

describe("RequireProject", () => {
  beforeEach(() => {
    localStorage.clear();
    navigateSpy.mockClear();
  });

  it("redirects to the overview when the workspace is empty, and renders children once a project exists", () => {
    const store = createTestStore();
    render(
      <StoreWrapper store={store}>
        <RequireProject>
          <p>form</p>
        </RequireProject>
      </StoreWrapper>,
    );
    expect(navigateSpy).toHaveBeenCalledWith("/overview");
    expect(screen.queryByText("form")).toBeNull();

    act(() => {
      store.set(createProjectAtom);
    });
    expect(screen.getByText("form")).toBeInTheDocument();
  });
});
