import { authStore, updateAuthStore } from "../authStore";
import { mapAuthError } from "../errors";
import { safeReturnTo } from "../redirects";

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
    [{ message: "Invalid login credentials" }, "invalid_credentials"],
    [{ message: "Email not confirmed" }, "email_not_confirmed"],
    [{ message: "User already registered" }, "email_taken"],
    [{ message: "Password should be at least 8 characters" }, "weak_password"],
    [{ status: 429, message: "Too many requests" }, "rate_limited"],
    [{ message: "Token has expired" }, "expired_link"],
  ])("normalizes provider error %#", (error, code) => {
    expect(mapAuthError(error)).toEqual({ code });
  });

  it("does not expose provider errors as a code", () => {
    expect(mapAuthError({ message: "internal database detail" })).toEqual({ code: "unknown" });
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
    expect(authStore.isRecoverySession).toBe(true);
    updateAuthStore(null);
    expect(authStore.isRecoverySession).toBe(false);
  });
});
