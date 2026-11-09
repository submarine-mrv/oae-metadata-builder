import { ActionIcon, Button, Stack, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCloud, IconCloudCheck, IconCloudX } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { authEnabled, authProvider } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import { projectSyncActionsAtom, projectSyncStatusAtom } from "../syncState";
import ProjectConflictResolution from "./ProjectConflictResolution";

export default function ProjectSyncIndicator() {
  const { user } = useAuth();
  const status = useAtomValue(projectSyncStatusAtom);
  const sync = useAtomValue(projectSyncActionsAtom);
  const [conflict, setConflict] = useState<{ projectId: string; message: string } | null>(null);
  if (!authEnabled || authProvider !== "supabase" || !user) return null;

  const failed = status.state === "error";
  const synced = status.state === "synced";
  const message = failed
    ? status.projectId
      ? `${status.message} Click to choose which version to keep.`
      : status.message
    : synced
      ? "Projects saved privately to your account."
      : "Waiting for cloud sync. Unsaved edits are only in this tab; keep it open until saved.";
  const Icon = failed ? IconCloudX : synced ? IconCloudCheck : IconCloud;

  return (
    <>
      <Tooltip label={message} multiline w={300} withArrow>
        <ActionIcon
          aria-label={
            failed ? "Project sync failed" : synced ? "Projects synced" : "Cloud sync pending"
          }
          color={failed ? "red" : synced ? "green" : "gray"}
          variant="subtle"
          size="lg"
          onClick={
            failed && status.projectId
              ? () =>
                  setConflict({ projectId: status.projectId as string, message: status.message })
              : failed
                ? () =>
                    notifications.show({
                      title: "Project sync failed",
                      message: status.noRetry ? (
                        message
                      ) : (
                        <Stack gap="xs">
                          <Text size="sm">{message}</Text>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              void sync?.flush().catch((error: unknown) =>
                                notifications.show({
                                  title: "Project sync failed",
                                  message:
                                    error instanceof Error
                                      ? error.message
                                      : "Could not save this project.",
                                  color: "red",
                                }),
                              )
                            }
                          >
                            Retry save
                          </Button>
                        </Stack>
                      ),
                      color: "red",
                    })
                : undefined
          }
        >
          <Icon size={22} />
        </ActionIcon>
      </Tooltip>
      {conflict && (
        <ProjectConflictResolution
          projectId={conflict.projectId}
          message={conflict.message}
          onClose={() => setConflict(null)}
        />
      )}
    </>
  );
}
