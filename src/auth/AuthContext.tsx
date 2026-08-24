import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
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
}

const AuthContext = createContext<AuthContextValue | null>(null);
const authClient = createAuthClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>({ ...authStore, client: authClient });

  useEffect(() => {
    let mounted = true;

    const publish = (
      session: AuthSession | null,
      profile: AuthProfile | null = null,
      event?: AuthEvent,
    ) => {
      updateAuthStore(session, profile, event);
      if (mounted) setState({ ...authStore, client: authClient });
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
      publish(session, undefined, event);
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
