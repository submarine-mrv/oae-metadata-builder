import { Alert, Button, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { useAtomValue, useStore } from "jotai";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { authEnabled, authProvider } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import RestorePrompt from "@/components/RestorePrompt";
import { workspaceAtom } from "@/state/atoms";
import { startPersistence } from "@/state/persistence";
import { hydrate } from "@/state/store";
import { exportMetadata } from "@/utils/exportImport";
import { startProjectCloudSync } from "./projectCloudSync";
import { localStorageWorkspaceStore } from "./storage";
import { LocalProjectMigration } from "./sync";
import { projectSyncActionsAtom, projectSyncErrorStatus, projectSyncStatusAtom } from "./syncState";
import { forkProjectRecord, type Workspace } from "./types";
import { emptyWorkspace } from "./workspace";

export default function ProjectPersistenceController({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const cloudEnabled = authEnabled && authProvider === "supabase";
  const identity = !cloudEnabled ? "guest" : status === "loading" ? null : (user?.id ?? "guest");
  const store = useStore();
  const syncStatus = useAtomValue(projectSyncStatusAtom);
  const [prepared, setPrepared] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [recovery, setRecovery] = useState<Record<string, { id: string; workspace: Workspace }[]>>(
    {},
  );
  const recovering = useRef(false);
  const preparationKey = identity === null ? null : `${identity}:${retry}`;

  useEffect(() => {
    if (identity === null) return;
    setPrepared(null);
    let cancelled = false;
    let cloud: ReturnType<typeof startProjectCloudSync> | null = null;
    store.set(projectSyncActionsAtom, null);
    store.set(workspaceAtom, emptyWorkspace());
    if (identity === "guest") {
      hydrate(store, localStorageWorkspaceStore);
      store.set(projectSyncStatusAtom, { state: "disabled" });
      const stop = startPersistence(store, localStorageWorkspaceStore, true);
      setPrepared(preparationKey);
      return stop;
    }
    store.set(projectSyncStatusAtom, { state: "loading" });
    void import("@/auth/providers/supabase/projectClient")
      .then(async ({ createProjectCloudClient }) => {
        if (cancelled) return;
        cloud = startProjectCloudSync(store, createProjectCloudClient(identity));
        await cloud.load();
        if (cancelled) return;
        store.set(projectSyncActionsAtom, cloud);
        setPrepared(preparationKey);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          store.set(projectSyncStatusAtom, {
            state: "error",
            message: error instanceof Error ? error.message : "Could not load cloud projects.",
          });
        }
      });
    return () => {
      cancelled = true;
      if (cloud?.hasPendingChanges()) {
        const workspace = store.get(workspaceAtom);
        const projects = cloud.getPendingProjects();
        const activeProjectId = projects.some((project) => project.id === workspace.activeProjectId)
          ? workspace.activeProjectId
          : (projects[0]?.id ?? null);
        const snapshot: Workspace = { ...workspace, activeProjectId, projects };
        setRecovery((previous) => ({
          ...previous,
          [identity]: [
            ...(previous[identity] ?? []),
            { id: crypto.randomUUID(), workspace: snapshot },
          ],
        }));
      }
      cloud?.stop();
      store.set(projectSyncActionsAtom, null);
      store.set(workspaceAtom, emptyWorkspace());
    };
  }, [identity, preparationKey, store]);

  useEffect(() => {
    if (Object.keys(recovery).length === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recovery]);

  const recover = async () => {
    if (!identity || !recovery[identity] || recovering.current) return;
    const sync = store.get(projectSyncActionsAtom);
    if (!sync) return;
    recovering.current = true;
    const snapshots = recovery[identity];
    try {
      const current = store.get(workspaceAtom);
      const projects = [...current.projects];
      for (const snapshot of snapshots) {
        for (const source of snapshot.workspace.projects) {
          const project = forkProjectRecord(source, {
            kind: "interrupted-recovery",
            sourceProjectId: source.id,
            snapshotId: snapshot.id,
          });
          const index = projects.findIndex((record) => record.id === project.id);
          if (index < 0) projects.push(project);
          else projects[index] = project;
        }
      }
      store.set(workspaceAtom, {
        ...current,
        projects,
        activeProjectId: current.activeProjectId ?? projects[0]?.id ?? null,
      });
      // These snapshots now live in Jotai. A failed save must retry them there, not import again.
      setRecovery((previous) => {
        const remaining = (previous[identity] ?? []).filter(
          (snapshot) => !snapshots.includes(snapshot),
        );
        if (remaining.length) return { ...previous, [identity]: remaining };
        const { [identity]: _, ...others } = previous;
        return others;
      });
      await sync.flush();
    } catch (error) {
      if (store.get(projectSyncActionsAtom) === sync)
        store.set(projectSyncStatusAtom, projectSyncErrorStatus(error));
    } finally {
      recovering.current = false;
    }
  };

  if (identity !== null && prepared === preparationKey) {
    return (
      <>
        {Object.keys(recovery).length > 0 && (
          <Alert color="red" title="An account change interrupted unsaved project edits">
            <Stack gap="xs">
              <Text>
                Unsaved drafts are retained only in this tab, isolated from other accounts. Sign
                back into the original account to recover or export them before closing or
                reloading.
              </Text>
              {identity !== "guest" && recovery[identity] && (
                <Group>
                  <Button onClick={recover}>Recover unsaved projects</Button>
                  <Button
                    variant="light"
                    onClick={() => {
                      for (const project of recovery[identity].flatMap(
                        (snapshot) => snapshot.workspace.projects,
                      )) {
                        exportMetadata(
                          project.state.projectData,
                          project.state.experiments,
                          project.state.datasets,
                        );
                      }
                    }}
                  >
                    Export unsaved projects
                  </Button>
                </Group>
              )}
            </Stack>
          </Alert>
        )}
        {identity !== "guest" && <LocalProjectMigration key={identity} />}
        {children}
        {identity === "guest" && <RestorePrompt />}
      </>
    );
  }
  return (
    <Center mih="100vh" p="md">
      {syncStatus.state === "error" ? (
        <Alert color="red" title="Cloud projects unavailable">
          <Stack>
            <Text>{syncStatus.message}</Text>
            <Button onClick={() => setRetry((value) => value + 1)}>Retry loading projects</Button>
          </Stack>
        </Alert>
      ) : (
        <Loader aria-label="Loading projects" />
      )}
    </Center>
  );
}
