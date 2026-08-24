export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  user: AuthUser;
}

export interface AuthProfile {
  displayName: string | null;
  organization: string | null;
  orcid: string | null;
  avatarUrl: string | null;
}

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "email_taken"
  | "weak_password"
  | "same_password"
  | "rate_limited"
  | "expired_link"
  | "network"
  | "unknown";

export interface AuthError {
  code: AuthErrorCode;
}

export interface AuthResult {
  session: AuthSession | null;
  user: AuthUser | null;
  error: AuthError | null;
}

export interface AuthClient {
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: (session: AuthSession | null, event: AuthEvent) => void): () => void;
  signUpWithPassword(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthResult>;
  signInWithPassword(input: { email: string; password: string }): Promise<AuthResult>;
  signInWithOtp(input: { email: string; redirectTo: string }): Promise<AuthResult>;
  signOut(scope?: "local" | "global"): Promise<void>;
  sendPasswordReset(email: string, redirectTo: string): Promise<AuthResult>;
  updatePassword(newPassword: string): Promise<AuthResult>;
  updateEmail(newEmail: string, redirectTo: string): Promise<AuthResult>;
  resendVerification(email: string, redirectTo: string): Promise<AuthResult>;
  exchangeCodeForSession(url: string): Promise<AuthResult>;
  getProfile(): Promise<AuthProfile | null>;
  updateProfile(patch: Partial<AuthProfile>): Promise<AuthProfile>;
}
