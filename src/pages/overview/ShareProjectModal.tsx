import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useStore } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import type { ProjectMember } from "@/workspace/projectCloudSync";
import { projectSyncActionsAtom } from "@/workspace/syncState";

type MembersClient = ReturnType<
  typeof import("@/auth/providers/supabase/projectClient").createProjectMembersClient
>;

const ROLE_OPTIONS = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

interface ShareProjectModalProps {
  projectId: string;
  isOwner: boolean;
  onClose(): void;
  /** Called after the user removes themselves from the project. */
  onLeft(): void;
}

/** Lists who is on a project. The owner adds people by email, changes roles and removes them. */
export default function ShareProjectModal({
  projectId,
  isOwner,
  onClose,
  onLeft,
}: ShareProjectModalProps) {
  const { user } = useAuth();
  const store = useStore();
  const [client, setClient] = useState<MembersClient | null>(null);
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void import("@/auth/providers/supabase/projectClient").then(
      ({ createProjectMembersClient }) => {
        if (!cancelled) setClient(createProjectMembersClient(user.id));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  const reload = useCallback(async () => {
    if (!client) return;
    setMembers(await client.list(projectId));
  }, [client, projectId]);

  useEffect(() => {
    reload().catch((cause: unknown) =>
      setError(
        cause instanceof Error ? cause.message : "Could not load the people on this project.",
      ),
    );
  }, [reload]);

  /** Runs a change, then reloads the list and checks the project's access again. */
  const run = async (change: (members: MembersClient) => Promise<void>) => {
    if (!client || busy) return false;
    setBusy(true);
    setError(null);
    try {
      await change(client);
      await reload();
      void store.get(projectSyncActionsAtom)?.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this project.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const address = email.trim();
    if (!address) return;
    if (await run((members) => members.set(projectId, address, role))) setEmail("");
  };

  // Leaving ends access, so the member list can't be reloaded afterwards.
  const leave = async () => {
    if (!client || !user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.remove(projectId, user.email);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not leave this project.");
      setBusy(false);
      return;
    }
    void store.get(projectSyncActionsAtom)?.refresh();
    onClose();
    onLeft();
  };

  const ownEmail = user?.email.toLowerCase();

  return (
    <Modal opened onClose={onClose} title={isOwner ? "Share project" : "People on this project"}>
      <Stack>
        {members === null && !error ? (
          <Loader size="sm" aria-label="Loading people" />
        ) : (
          <Stack gap="xs">
            {members?.map((member) => (
              <Group key={member.email} justify="space-between" wrap="nowrap">
                <Text size="sm" truncate>
                  {member.email}
                  {member.email === ownEmail ? " (you)" : ""}
                </Text>
                {member.role === "owner" ? (
                  <Text size="sm" c="dimmed">
                    Owner
                  </Text>
                ) : isOwner ? (
                  <Group gap={4} wrap="nowrap">
                    <Select
                      size="xs"
                      w={110}
                      aria-label={`Role for ${member.email}`}
                      data={ROLE_OPTIONS}
                      value={member.role}
                      allowDeselect={false}
                      disabled={busy}
                      onChange={(value) => {
                        if (value === "editor" || value === "viewer") {
                          void run((client) => client.set(projectId, member.email, value));
                        }
                      }}
                    />
                    <Tooltip label="Remove">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Remove ${member.email}`}
                        disabled={busy}
                        onClick={() => void run((client) => client.remove(projectId, member.email))}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ) : (
                  <Text size="sm" c="dimmed">
                    {member.role === "editor" ? "Editor" : "Viewer"}
                  </Text>
                )}
              </Group>
            ))}
          </Stack>
        )}

        {error && <Alert color="red">{error}</Alert>}

        {isOwner ? (
          <Stack gap={4}>
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                label="Add by email"
                placeholder="name@example.com"
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void add();
                }}
              />
              <Select
                w={110}
                aria-label="Role"
                data={ROLE_OPTIONS}
                value={role}
                allowDeselect={false}
                disabled={busy}
                onChange={(value) => {
                  if (value === "editor" || value === "viewer") setRole(value);
                }}
              />
              <Button onClick={() => void add()} loading={busy} disabled={!email.trim()}>
                Add
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              They'll see this project when they sign in with this email.
            </Text>
          </Stack>
        ) : (
          <Group justify="flex-end">
            <Button variant="light" color="red" onClick={() => void leave()} loading={busy}>
              Leave project
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
