const PENDING_EMAIL_KEY = "oae-pending-verification-email";

export function setPendingVerificationEmail(email: string): void {
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // The verification page can still be used without a prefilled address.
  }
}

export function getPendingVerificationEmail(): string {
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}
