import { MemoryAuthClient } from "./memoryClient";
import { supabaseAuthClient } from "./providers/supabase/adapter";
import type { AuthClient } from "./types";

export function createAuthClient(): AuthClient {
  if (import.meta.env.VITE_AUTH_ENABLED === "false") return new MemoryAuthClient();
  const provider = import.meta.env.VITE_AUTH_PROVIDER ?? "supabase";
  if (provider !== "supabase") {
    throw new Error(`Unsupported auth provider: ${provider}`);
  }
  return supabaseAuthClient;
}

export type {
  AuthClient,
  AuthError,
  AuthErrorCode,
  AuthEvent,
  AuthProfile,
  AuthResult,
  AuthSession,
  AuthStatus,
  AuthUser,
} from "./types";
