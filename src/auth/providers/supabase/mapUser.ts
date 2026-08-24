import type { Session, User } from "@supabase/supabase-js";
import type { AuthSession, AuthUser } from "../../types";

export function mapUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
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
