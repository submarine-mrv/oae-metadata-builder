import { authStore, updateAuthStore } from "../authStore";
import { getPasswordUpdateErrorMessage, getReauthErrorMessage, mapAuthError } from "../errors";
import { getPasswordStrength } from "../passwordStrength";
import { buildAuthRedirectUrl, safeReturnTo } from "../redirects";

describe("getPasswordStrength", () => {
  it.each([
    ["", 0],
    ["password", 50],
    ["Password", 75],
    ["Password1", 100],
  ])("scores password strength for %s", (password, strength) => {
    expect(getPasswordStrength(password)).toBe(strength);
  });
});

describe("buildAuthRedirectUrl", () => {
  it("uses the current deploy preview origin and encodes the return path", () => {
    expect(
      buildAuthRedirectUrl({
        type: "recovery",
        returnTo: "/auth/reset-password?type=recovery",
        origin: "https://deploy-preview-42--oae-mb.netlify.app",
      }),
    ).toBe(
      "https://deploy-preview-42--oae-mb.netlify.app/auth/callback?type=recovery&returnTo=%2Fauth%2Freset-password%3Ftype%3Drecovery",
    );
  });
});

describe("safeReturnTo", () => {
  it.each([
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "%2F%2Fevil.example",
  ])("rejects unsafe return path %s", (value) => {
    expect(safeReturnTo(value)).toBeNull();
  });

  it("accepts a same-origin path with query and hash", () => {
    expect(safeReturnTo("/project?tab=1#details")).toBe("/project?tab=1#details");
  });
});

describe("mapAuthError", () => {
  it.each([
    [{ code: "invalid_credentials", message: "Invalid login credentials" }, "invalid_credentials"],
    [{ code: "email_not_confirmed", message: "Email not confirmed" }, "email_not_confirmed"],
    [{ code: "user_already_exists", message: "User already registered" }, "email_taken"],
    [
      { code: "weak_password", message: "Password should be at least 8 characters" },
      "weak_password",
    ],
    [{ code: "password_too_weak", message: "Password is too weak" }, "weak_password"],
    [{ code: "same_password", message: "New password should be different" }, "same_password"],
    [
      { code: "reauthentication_needed", message: "Reauthentication is required" },
      "reauthentication_needed",
    ],
    [{ code: "over_request_rate_limit", message: "Too many requests" }, "rate_limited"],
    [{ status: 429, message: "Too many requests" }, "rate_limited"],
    [{ code: "otp_expired", message: "Token has expired" }, "expired_link"],
  ])("normalizes provider error %#", (error, code) => {
    expect(mapAuthError(error)).toEqual({ code });
  });

  it("does not expose provider errors as a code", () => {
    expect(mapAuthError({ message: "internal database detail" })).toEqual({ code: "unknown" });
  });
});

describe("reauth error messages", () => {
  it("maps re-auth failures to the correct user-facing message", () => {
    expect(getReauthErrorMessage("invalid_credentials")).toBe("Current password is incorrect.");
    expect(getReauthErrorMessage("email_not_confirmed")).toBe(
      "Your email is not confirmed. Check your inbox for a confirmation link.",
    );
    expect(getReauthErrorMessage("network")).toBe(
      "We could not reach the server. Check your connection and try again.",
    );
    expect(getReauthErrorMessage("unknown")).toBe("Something went wrong. Please try again.");
  });
});

describe("password update error messages", () => {
  it("explains when the new password matches the current password", () => {
    expect(getPasswordUpdateErrorMessage("same_password")).toBe(
      "New password must be different from your old password.",
    );
  });

  it("explains when reauthentication is required", () => {
    expect(getPasswordUpdateErrorMessage("reauthentication_needed")).toBe(
      "Please sign in again to confirm this password change.",
    );
  });

  it("explains weak password errors with the same guidance used elsewhere", () => {
    expect(getPasswordUpdateErrorMessage("weak_password")).toContain("8 characters");
  });
});

describe("createAuthClient", () => {
  it("returns the in-memory client while auth is disabled", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_AUTH_ENABLED", "false");

    const { createAuthClient } = await import("../index");
    const client = createAuthClient();

    await expect(client.getSession()).resolves.toBeNull();
    await expect(
      client.signInWithPassword({ email: "person@example.com", password: "password" }),
    ).resolves.toMatchObject({ error: null, user: { email: "person@example.com" } });
  });
});

describe("auth state", () => {
  it("marks a PASSWORD_RECOVERY event as a recovery session", () => {
    const session = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: null,
      user: { id: "user-1", email: "one@example.com", emailVerified: false, createdAt: "now" },
    };
    updateAuthStore(session, null, "PASSWORD_RECOVERY");
    expect(authStore.isRecoverySession).toBe(true);
    updateAuthStore(session, null, "SIGNED_IN");
    expect(authStore.isRecoverySession).toBe(false);
    updateAuthStore(null);
    expect(authStore.isRecoverySession).toBe(false);
  });

  it("restores a recovery session from the access token after reload", () => {
    const session = {
      accessToken: "header.eyJhbXIiOlt7Im1ldGhvZCI6InJlY292ZXJ5In1dfQ.signature",
      refreshToken: "refresh",
      expiresAt: null,
      user: { id: "user-1", email: "one@example.com", emailVerified: false, createdAt: "now" },
    };

    updateAuthStore(session, null, "INITIAL_SESSION");

    expect(authStore.isRecoverySession).toBe(true);
  });
});
