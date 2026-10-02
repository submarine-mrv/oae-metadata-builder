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

function sessionHasRecoveryAmr(session: AuthSession): boolean {
  try {
    const encodedPayload = session.accessToken.split(".")[1];
    const base64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(paddedPayload)) as {
      amr?: Array<{ method?: string } | string>;
    };
    return (
      payload.amr?.some((method) =>
        typeof method === "string" ? method === "recovery" : method.method === "recovery",
      ) ?? false
    );
  } catch {
    return false;
  }
}

function isRecoverySessionForState(session: AuthSession | null, event?: AuthEvent): boolean {
  if (!session) return false;
  if (event === "PASSWORD_RECOVERY") return true;
  if (sessionHasRecoveryAmr(session)) return true;
  return false;
}

export function updateAuthStore(
  session: AuthSession | null,
  profile: AuthProfile | null = null,
  event?: AuthEvent,
): void {
  const isRecoverySession = isRecoverySessionForState(session, event);

  authStore.status = session ? "authenticated" : "unauthenticated";
  authStore.session = session;
  authStore.user = session?.user ?? null;
  authStore.profile = profile;
  authStore.isAuthenticated = Boolean(session);
  authStore.isRecoverySession = isRecoverySession;
}
