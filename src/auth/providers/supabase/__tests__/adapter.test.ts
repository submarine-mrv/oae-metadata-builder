import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
const verifyOtp = vi.fn();
const getSession = vi.fn();
const updateUser = vi.fn();
const getUser = vi.fn();
type QueryResponse = { data: unknown; error: unknown };
const single = vi.fn<() => Promise<QueryResponse>>();
const maybeSingle = vi.fn<() => Promise<QueryResponse>>();
const query = { single, maybeSingle };
const eq = vi.fn(() => query);
const select = vi.fn(() => ({ eq, ...query }));
const upsert = vi.fn(() => ({ select }));
const from = vi.fn(() => ({ select, upsert }));

vi.mock("../client", () => ({
  supabase: {
    auth: {
      getSession,
      getUser,
      signOut,
      verifyOtp,
      updateUser,
    },
    from,
  },
}));

describe("supabaseAuthClient", () => {
  beforeEach(() => {
    signOut.mockReset();
    verifyOtp.mockReset();
    getSession.mockReset();
    updateUser.mockReset();
    getUser.mockReset();
    single.mockReset();
    maybeSingle.mockReset();
    eq.mockClear();
    select.mockClear();
    upsert.mockClear();
    from.mockClear();
  });

  it("loads the stored display name from the profile row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingle.mockResolvedValue({
      data: {
        display_name: "Metadata researcher",
        organization: "OAE Data Commons",
        orcid: "0000-0000-0000-0000",
      },
      error: null,
    });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(supabaseAuthClient.getProfile()).resolves.toEqual({
      displayName: "Metadata researcher",
      organization: "OAE Data Commons",
      orcid: "0000-0000-0000-0000",
    });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("display_name, organization, orcid");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("returns no profile when the user has no profile row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(supabaseAuthClient.getProfile()).resolves.toBeNull();
  });

  it("upserts a missing profile row and normalizes cleared fields", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    single.mockResolvedValue({
      data: { display_name: null, organization: null, orcid: null },
      error: null,
    });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(
      supabaseAuthClient.updateProfile({ displayName: "", organization: "", orcid: "" }),
    ).resolves.toEqual({ displayName: null, organization: null, orcid: null });
    expect(upsert).toHaveBeenCalledWith(
      { id: "user-1", display_name: null, organization: null, orcid: null },
      { onConflict: "id" },
    );
  });

  it("resolves after local sign-out when the provider reports a remote error", async () => {
    signOut.mockResolvedValue({ error: { message: "Network request failed" } });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(supabaseAuthClient.signOut("local")).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("verifies a recovery token hash and normalizes expired links", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null },
      error: { code: "otp_expired", message: "Token has expired" },
    });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(supabaseAuthClient.verifyOtp("recovery-token", "recovery")).resolves.toEqual({
      session: null,
      user: null,
      error: { code: "expired_link" },
    });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "recovery-token", type: "recovery" });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("reads the current user after confirming an email change", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access",
          refresh_token: "refresh",
          expires_at: 123,
          user: {
            id: "user-1",
            email: "old@example.com",
            email_confirmed_at: "2026-09-15T00:00:00Z",
            created_at: "2026-09-01T00:00:00Z",
          },
        },
      },
      error: null,
    });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "new@example.com",
          email_confirmed_at: "2026-09-15T00:00:00Z",
          created_at: "2026-09-01T00:00:00Z",
        },
      },
      error: null,
    });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(
      supabaseAuthClient.verifyOtp("email-change-token", "email_change"),
    ).resolves.toEqual({
      session: {
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: 123,
        user: {
          id: "user-1",
          email: "new@example.com",
          emailVerified: true,
          createdAt: "2026-09-01T00:00:00Z",
        },
      },
      user: {
        id: "user-1",
        email: "new@example.com",
        emailVerified: true,
        createdAt: "2026-09-01T00:00:00Z",
      },
      error: null,
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "email-change-token",
      type: "email_change",
    });
    expect(getSession).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("does not fail email-change confirmation when the current user read fails", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(
      supabaseAuthClient.verifyOtp("email-change-token", "email_change"),
    ).resolves.toEqual({
      session: null,
      user: null,
      error: null,
    });
  });

  it("starts a Supabase email change with a new-email confirmation link", async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: null });

    const { supabaseAuthClient } = await import("../adapter");

    await expect(
      supabaseAuthClient.updateEmail(
        "new@example.com",
        "https://example.com/auth/callback?type=email_change",
      ),
    ).resolves.toEqual({ session: null, user: null, error: null });
    expect(updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "https://example.com/auth/callback?type=email_change" },
    );
  });
});
