import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectCountAtom } from "@/state/atoms";
import { createTestStore, StoreWrapper } from "@/state/testing";
import WelcomePage from "../WelcomePage";

const navigate = vi.fn();
vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({ client: { signOut: vi.fn() }, user: null, isAuthenticated: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useLocation: ({ select }: { select?: (s: { pathname: string }) => unknown }) =>
    select ? select({ pathname: "/overview" }) : { pathname: "/overview" },
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

describe("WelcomePage", () => {
  beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
  });

  it("creates the first project and goes to the project form", () => {
    const store = createTestStore();
    render(
      <MantineProvider>
        <StoreWrapper store={store}>
          <WelcomePage />
        </StoreWrapper>
      </MantineProvider>,
    );
    expect(
      screen.getByRole("heading", { name: /Welcome to the OAE Metadata Builder/ }),
    ).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Create your first project" }).click());
    expect(store.get(projectCountAtom)).toBe(1);
    expect(navigate).toHaveBeenCalledWith({ to: "/project" });
  });
});
