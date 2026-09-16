import type { AuthError, AuthErrorCode, AuthResult } from "./types";

type ProviderError = { message?: string; status?: number; code?: string } | null;

// Shared by LoginForm and profile.tsx; each spreads this and overrides context-specific codes.
export const COMMON_AUTH_ERROR_MESSAGES: Partial<Record<AuthErrorCode, string>> = {
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  network: "We could not reach the server. Check your connection and try again.",
};

export function getReauthErrorMessage(code: AuthErrorCode | null | undefined): string {
  const REAUTH_ERROR_MESSAGES: Partial<Record<AuthErrorCode, string>> = {
    ...COMMON_AUTH_ERROR_MESSAGES,
    invalid_credentials: "Current password is incorrect.",
    email_not_confirmed: "Your email is not confirmed. Check your inbox for a confirmation link.",
    unknown: "Something went wrong. Please try again.",
  };

  return REAUTH_ERROR_MESSAGES[code ?? "unknown"] ?? "Current password is incorrect.";
}

export function getPasswordUpdateErrorMessage(code: AuthErrorCode | null | undefined): string {
  const PASSWORD_UPDATE_ERROR_MESSAGES: Partial<Record<AuthErrorCode, string>> = {
    ...COMMON_AUTH_ERROR_MESSAGES,
    weak_password:
      "Choose a stronger password. Must contain at least 8 characters, including a small letter, a capital letter, and a number.",
    same_password: "New password must be different from your old password.",
    reauthentication_needed: "Please sign in again to confirm this password change.",
    unknown: "We could not update your password.",
  };

  return PASSWORD_UPDATE_ERROR_MESSAGES[code ?? "unknown"] ?? "We could not update your password.";
}

const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  password_too_weak: "weak_password",
  same_password: "same_password",
  reauthentication_needed: "reauthentication_needed",
  reauthentication_required: "reauthentication_needed",
  auth_reauthentication_needed: "reauthentication_needed",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  over_sms_send_rate_limit: "rate_limited",
  otp_expired: "expired_link",
  session_expired: "expired_link",
  refresh_token_not_found: "expired_link",
  flow_state_expired: "expired_link",
};

export function mapAuthError(error: ProviderError): AuthError | null {
  if (!error) return null;

  if (error.code && CODE_MAP[error.code]) {
    return { code: CODE_MAP[error.code] };
  }

  const message = error.message?.toLowerCase() ?? "";
  let code: AuthErrorCode = "unknown";

  if (error.status === 429 || message.includes("rate limit") || message.includes("too many")) {
    code = "rate_limited";
  } else if (
    message.includes("reauth") ||
    message.includes("re-auth") ||
    message.includes("reauthentication")
  ) {
    code = "reauthentication_needed";
  } else if (
    message.includes("weak password") ||
    message.includes("password is too weak") ||
    message.includes("needs at least 8")
  ) {
    code = "weak_password";
  } else if (
    message.includes("same password") ||
    message.includes("different from your old password")
  ) {
    code = "same_password";
  } else if (message.includes("network") || message.includes("fetch")) {
    code = "network";
  }

  return { code };
}

export function failedResult(error: ProviderError): AuthResult {
  return { session: null, user: null, error: mapAuthError(error) };
}
