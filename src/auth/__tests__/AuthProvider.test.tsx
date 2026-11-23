import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthEvent, AuthProfile, AuthSession } from "../types";

const client = vi.hoisted(() => {
  let resolveProfile: (profile: AuthProfile | null) => void = () => {};
  let emit: (session: AuthSession | null, event: AuthEvent) => void = () => {};
  return {
    getSession: vi.fn(),
    getProfile: vi.fn(
      () =>
        new Promise<AuthProfile | null>((resolve) => {
          resolveProfile = resolve;
        }),
    ),
    onAuthStateChange: vi.fn((callback: typeof emit) => {
      emit = callback;
      return () => {};
    }),
    resolveProfile: (profile: AuthProfile | null) => resolveProfile(profile),
    emit: (session: AuthSession | null, event: AuthEvent) => emit(session, event),
  };
});
vi.mock("../index", () => ({ createAuthClient: () => client }));
vi.mock("../../router", () => ({ router: { invalidate: vi.fn() } }));

const { AuthProvider, useAuth } = await import("../AuthContext");

function session(needsPassword?: boolean): AuthSession {
  return {
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: 0,
    user: {
      id: "invitee",
      email: "invitee@example.com",
      emailVerified: true,
      createdAt: "2026-01-01",
      ...(needsPassword ? { needsPassword } : {}),
    },
  };
}

function Probe() {
  const { user, profile } = useAuth();
  return (
    <p>
      {user?.needsPassword ? "needs-password" : "password-set"} {profile?.displayName ?? "none"}
    </p>
  );
}

describe("AuthProvider", () => {
  it("keeps a newer session when a slow profile fetch resolves", async () => {
    client.getSession.mockResolvedValue(session(true));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("needs-password none");

    // The password is set while the first profile fetch is still in flight.
    act(() => client.emit(session(), "USER_UPDATED"));
    await screen.findByText("password-set none");

    await act(async () => {
      client.resolveProfile({ displayName: "Invitee", organization: null, orcid: null });
    });
    expect(screen.getByText("password-set Invitee")).toBeTruthy();
  });
});
