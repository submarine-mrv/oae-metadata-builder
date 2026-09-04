import type { AuthError, AuthErrorCode, AuthResult } from "./types";

type ProviderError = { message?: string; status?: number; code?: string } | null;

const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  same_password: "same_password",
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
  } else if (message.includes("network") || message.includes("fetch")) {
    code = "network";
  }

  return { code };
}

export function failedResult(error: ProviderError): AuthResult {
  return { session: null, user: null, error: mapAuthError(error) };
}
