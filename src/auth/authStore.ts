import type { AuthEvent, AuthProfile, AuthSession, AuthStatus, AuthUser } from "./types";

export interface AuthStore {
  status: AuthStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  profile: AuthProfile | null;
  isAuthenticated: boolean;
  isRecoverySession: boolean;
}

export const authStore: AuthStore = {
  status: "loading",
  session: null,
  user: null,
  profile: null,
  isAuthenticated: false,
  isRecoverySession: false,
};

export function updateAuthStore(
  session: AuthSession | null,
  profile: AuthProfile | null = null,
  event?: AuthEvent,
): void {
  authStore.status = session ? "authenticated" : "unauthenticated";
  authStore.session = session;
  authStore.user = session?.user ?? null;
  authStore.profile = profile;
  authStore.isAuthenticated = Boolean(session);
  authStore.isRecoverySession =
    Boolean(session) && (event === "PASSWORD_RECOVERY" || authStore.isRecoverySession);
}
