import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { router } from "../router";
import { authStore, updateAuthStore } from "./authStore";
import { createAuthClient } from "./index";
import type { AuthClient, AuthEvent, AuthProfile, AuthSession, AuthUser } from "./types";

interface AuthContextValue {
  status: typeof authStore.status;
  session: AuthSession | null;
  user: AuthUser | null;
  profile: AuthProfile | null;
  isAuthenticated: boolean;
  isRecoverySession: boolean;
  client: AuthClient;
  setProfile: (profile: AuthProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const authClient = createAuthClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const setProfile = useCallback((profile: AuthProfile | null) => {
    authStore.profile = profile;
    setState((prev) => ({ ...authStore, client: authClient, setProfile: prev.setProfile }));
  }, []);

  const [state, setState] = useState<AuthContextValue>({
    ...authStore,
    client: authClient,
    setProfile,
  });

  useEffect(() => {
    let mounted = true;

    const publish = (
      session: AuthSession | null,
      profile: AuthProfile | null = null,
      event?: AuthEvent,
    ) => {
      updateAuthStore(session, profile, event);
      if (mounted) {
        setState((prev) => ({ ...authStore, client: authClient, setProfile: prev.setProfile }));
      }
      void router.invalidate();
    };

    void authClient
      .getSession()
      .then((session) => {
        if (!session) {
          publish(null);
          return;
        }
        return authClient
          .getProfile()
          .catch(() => null)
          .then((profile) => publish(session, profile));
      })
      .catch(() => publish(null));

    const unsubscribe = authClient.onAuthStateChange((session, event) => {
      if (!session) {
        publish(null, null, event);
        return;
      }
      publish(session, null, event);
      void authClient
        .getProfile()
        .catch(() => null)
        .then((profile) => publish(session, profile));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
