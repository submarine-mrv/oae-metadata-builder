import { Alert, Button, Center, Loader, Stack, Text } from "@mantine/core";
import { useAtomValue, useStore } from "jotai";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { workspaceSyncRetryAtom, workspaceSyncStatusAtom } from "@/state/atoms";
import {
  activateWorkspaceAccount,
  deactivateStoredWorkspaceAccount,
  deactivateWorkspaceAccount,
  startWorkspaceSync,
} from "./cloudSync";

export default function WorkspaceSyncController({ children }: { children: ReactNode }) {
  const { isAuthenticated, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const store = useStore();
  const syncStatus = useAtomValue(workspaceSyncStatusAtom);
  const [preparedIdentity, setPreparedIdentity] = useState<string | null>(null);
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED === "true";
  const expectedIdentity =
    isAuthenticated && userId ? userId : authStatus === "unauthenticated" ? "guest" : null;

  useEffect(() => {
    if (!authEnabled || authStatus === "loading") return;

    if (!isAuthenticated || !userId) {
      try {
        deactivateStoredWorkspaceAccount(store);
        setPreparedIdentity("guest");
      } catch (error) {
        store.set(workspaceSyncStatusAtom, {
          state: "error",
          message:
            error instanceof Error ? error.message : "Could not prepare the guest workspace.",
        });
      }
      return;
    }

    let cancelled = false;
    let accountActivated = false;
    let controller: ReturnType<typeof startWorkspaceSync> | null = null;

    store.set(workspaceSyncStatusAtom, { state: "syncing" });
    try {
      activateWorkspaceAccount(store, userId);
      accountActivated = true;
      setPreparedIdentity(userId);
    } catch (error) {
      store.set(workspaceSyncStatusAtom, {
        state: "error",
        message:
          error instanceof Error ? error.message : "Could not prepare this account's workspace.",
      });
      return;
    }

    void import("./supabaseWorkspaceClient")
      .then(({ supabaseWorkspaceClient }) => {
        if (cancelled) return;
        controller = startWorkspaceSync(store, supabaseWorkspaceClient, (status) => {
          store.set(workspaceSyncStatusAtom, status);
        });
        store.set(workspaceSyncRetryAtom, () => controller?.retry());
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        store.set(workspaceSyncStatusAtom, {
          state: "error",
          message: error instanceof Error ? error.message : "Could not start workspace sync.",
        });
      });

    return () => {
      cancelled = true;
      controller?.stop();
      store.set(workspaceSyncRetryAtom, null);
      if (accountActivated) {
        try {
          deactivateWorkspaceAccount(store, userId);
        } catch (error) {
          store.set(workspaceSyncStatusAtom, {
            state: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not preserve this account's local workspace.",
          });
          return;
        }
      }
      store.set(workspaceSyncStatusAtom, { state: "disabled" });
    };
  }, [authStatus, isAuthenticated, store, userId]);

  if (!authEnabled || (expectedIdentity !== null && preparedIdentity === expectedIdentity)) {
    return children;
  }

  return (
    <Center mih="100vh" p="md">
      {syncStatus.state === "error" ? (
        <Alert color="red" title="Workspace unavailable" maw={480}>
          <Stack gap="sm">
            <Text>{syncStatus.message}</Text>
            <Button variant="light" onClick={() => window.location.reload()}>
              Reload and retry
            </Button>
          </Stack>
        </Alert>
      ) : (
        <Loader size="sm" aria-label="Preparing workspace" />
      )}
    </Center>
  );
}
