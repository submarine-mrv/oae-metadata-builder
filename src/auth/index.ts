import { MemoryAuthClient } from "./memoryClient";
import type { AuthClient } from "./types";

function createSupabaseAuthClient(): AuthClient {
  let adapter: AuthClient | null = null;
  let adapterPromise: Promise<AuthClient> | null = null;

  const loadAdapter = async (): Promise<AuthClient> => {
    if (adapter) return adapter;
    if (!adapterPromise) {
      adapterPromise = import("./providers/supabase/adapter").then((module) => {
        adapter = module.supabaseAuthClient;
        return adapter;
      });
    }
    return adapterPromise;
  };

  const withAdapter = async <T>(action: (client: AuthClient) => Promise<T> | T): Promise<T> => {
    const client = await loadAdapter();
    return action(client);
  };

  return {
    async getSession() {
      return withAdapter((client) => client.getSession());
    },
    onAuthStateChange(callback) {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;
      void loadAdapter().then((client) => {
        if (cancelled) return;
        unsubscribe = client.onAuthStateChange(callback);
      });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
    async signUpWithPassword(input) {
      return withAdapter((client) => client.signUpWithPassword(input));
    },
    async signInWithPassword(input) {
      return withAdapter((client) => client.signInWithPassword(input));
    },
    async signInWithOtp(input) {
      return withAdapter((client) => client.signInWithOtp(input));
    },
    async signOut(scope) {
      return withAdapter((client) => client.signOut(scope));
    },
    async sendPasswordReset(email, redirectTo) {
      return withAdapter((client) => client.sendPasswordReset(email, redirectTo));
    },
    async updatePassword(newPassword) {
      return withAdapter((client) => client.updatePassword(newPassword));
    },
    async updateEmail(newEmail, redirectTo) {
      return withAdapter((client) => client.updateEmail(newEmail, redirectTo));
    },
    async resendVerification(email, redirectTo) {
      return withAdapter((client) => client.resendVerification(email, redirectTo));
    },
    async verifyOtp(tokenHash, type) {
      return withAdapter((client) => client.verifyOtp(tokenHash, type));
    },
    async getProfile() {
      return withAdapter((client) => client.getProfile());
    },
    async updateProfile(patch) {
      return withAdapter((client) => client.updateProfile(patch));
    },
    async deleteAccount() {
      return withAdapter((client) => client.deleteAccount());
    },
  } as AuthClient;
}

export function createAuthClient(): AuthClient {
  if (import.meta.env.VITE_AUTH_ENABLED !== "true") return new MemoryAuthClient();
  const provider = import.meta.env.VITE_AUTH_PROVIDER ?? "supabase";
  if (provider !== "supabase") {
    throw new Error(`Unsupported auth provider: ${provider}`);
  }
  return createSupabaseAuthClient();
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
