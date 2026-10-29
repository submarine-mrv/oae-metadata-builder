import { ActionIcon, Button, Stack, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCloud, IconCloudCheck, IconCloudX } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { authEnabled, authProvider } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import { projectSyncActionsAtom, projectSyncStatusAtom } from "../syncState";

export default function ProjectSyncIndicator() {
  const { user } = useAuth();
  const status = useAtomValue(projectSyncStatusAtom);
  const sync = useAtomValue(projectSyncActionsAtom);
  if (!authEnabled || authProvider !== "supabase" || !user) return null;

  const failed = status.state === "error";
  const synced = status.state === "synced";
  const message = failed
    ? status.message
    : synced
      ? "Projects saved privately to your account."
      : "Waiting for cloud sync. Unsaved edits are only in this tab; keep it open until saved.";
  const Icon = failed ? IconCloudX : synced ? IconCloudCheck : IconCloud;

  return (
    <Tooltip label={message} multiline w={300} withArrow>
      <ActionIcon
        aria-label={
          failed ? "Project sync failed" : synced ? "Projects synced" : "Cloud sync pending"
        }
        color={failed ? "red" : synced ? "green" : "gray"}
        variant="subtle"
        size="lg"
        onClick={() =>
          notifications.show({
            title: failed ? "Project sync failed" : "Cloud sync",
            message: failed ? (
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
                          error instanceof Error ? error.message : "Could not save this project.",
                        color: "red",
                      }),
                    )
                  }
                >
                  Retry save
                </Button>
              </Stack>
            ) : (
              message
            ),
            color: failed ? "red" : synced ? "green" : "gray",
          })
        }
      >
        <Icon size={22} />
      </ActionIcon>
    </Tooltip>
  );
}
