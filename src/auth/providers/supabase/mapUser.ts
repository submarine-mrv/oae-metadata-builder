import type { Session, User } from "@supabase/supabase-js";
import type { AuthSession, AuthUser } from "../../types";

/** Set in user metadata alongside every password change, see the adapter's updatePassword. */
export const PASSWORD_SET_METADATA_KEY = "password_set";

export function mapUser(user: User): AuthUser {
  // Supabase gives an accepted invite a random password and drops a password typed into
  // sign-up for an invited address, so invited users have no usable password until they set one.
  const needsPassword =
    Boolean(user.invited_at) && user.user_metadata?.[PASSWORD_SET_METADATA_KEY] !== true;
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
    ...(needsPassword ? { needsPassword } : {}),
  };
}

export function mapSession(session: Session | null): AuthSession | null {
  if (!session) return null;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    user: mapUser(session.user),
  };
}
