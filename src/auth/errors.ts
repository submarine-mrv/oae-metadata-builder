import type { AuthError, AuthErrorCode, AuthResult } from "./types";

type ProviderError = { message?: string; status?: number } | null;

export function mapAuthError(error: ProviderError): AuthError | null {
  if (!error) return null;

  const message = error.message?.toLowerCase() ?? "";
  let code: AuthErrorCode = "unknown";

  if (error.status === 429 || message.includes("rate limit") || message.includes("too many")) {
    code = "rate_limited";
  } else if (message.includes("invalid login") || message.includes("invalid credentials")) {
    code = "invalid_credentials";
  } else if (message.includes("email not confirmed")) {
    code = "email_not_confirmed";
  } else if (message.includes("already registered") || message.includes("already exists")) {
    code = "email_taken";
  } else if (
    message.includes("password") &&
    (message.includes("weak") || message.includes("length") || message.includes("characters"))
  ) {
    code = "weak_password";
  } else if (message.includes("expired") || message.includes("invalid token")) {
    code = "expired_link";
  } else if (message.includes("network") || message.includes("fetch")) {
    code = "network";
  }

  return { code };
}

export function failedResult(error: ProviderError): AuthResult {
  return { session: null, user: null, error: mapAuthError(error) };
}
