import {
  ActionIcon,
  Alert,
  Badge,
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
import { IconMailForward, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useStore } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import type { ProjectMember } from "@/workspace/projectCloudSync";
import { projectSyncActionsAtom } from "@/workspace/syncState";

type ProjectClientModule = typeof import("@/auth/providers/supabase/projectClient");
type MembersClient = ReturnType<ProjectClientModule["createProjectMembersClient"]>;
type InviteResult = Awaited<ReturnType<MembersClient["invite"]>>;

/** Messages for the project-members function's error codes. */
const MEMBER_ERROR_MESSAGES: Record<string, string> = {
  cooldown: "Please wait a minute before resending this invitation.",
  rate_limited: "Too many invitations were sent recently. Try again in an hour.",
  invite_failed: "We couldn't send the invitation email. Please try again.",
};

/** Only a failed invitation email needs a message; the list shows who is pending. */
function inviteWarning(result: InviteResult, email: string): string | undefined {
  if (result.status !== "invite_failed") return undefined;
  return result.reason === "rate_limited"
    ? `Added ${email}, but too many invitations were sent recently. Use Resend in an hour.`
    : `Added ${email}, but the invitation email couldn't be sent. Try Resend.`;
}

function errorMessage(cause: unknown, fallback: string) {
  if (!(cause instanceof Error)) return fallback;
  const code = (cause as { code?: unknown }).code;
  return (typeof code === "string" && MEMBER_ERROR_MESSAGES[code]) || cause.message;
}

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
  const [warning, setWarning] = useState<string | null>(null);

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
  const run = async (change: (members: MembersClient) => Promise<string | undefined>) => {
    if (!client || busy) return false;
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      setWarning((await change(client)) ?? null);
      await reload();
      void store.get(projectSyncActionsAtom)?.refresh();
      return true;
    } catch (cause) {
      setError(errorMessage(cause, "Could not update this project."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const address = email.trim();
    if (!address) return;
    const added = await run(async (members) =>
      inviteWarning(await members.invite(projectId, address, role), address),
    );
    if (added) setEmail("");
  };

  // Leaving ends access, so the member list can't be reloaded afterwards.
  const leave = async () => {
    if (!client || !user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.remove(projectId, user.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not leave this project.");
      setBusy(false);
      return;
    }
    void store.get(projectSyncActionsAtom)?.refresh();
    onClose();
    onLeft();
  };

  return (
    <Modal opened onClose={onClose} title={isOwner ? "Share project" : "People on this project"}>
      <Stack>
        {members === null && !error ? (
          <Loader size="sm" aria-label="Loading people" />
        ) : (
          <Stack gap="xs">
            {members?.map((member) => (
              <Group key={member.userId} justify="space-between" wrap="nowrap">
                <Stack gap={0} className="min-w-0">
                  <Group gap={6} wrap="nowrap" className="min-w-0">
                    <Text size="sm" truncate>
                      {member.email}
                      {member.userId === user?.id ? " (you)" : ""}
                    </Text>
                    {member.status === "pending" && (
                      <Badge size="xs" variant="light" color="yellow" className="shrink-0">
                        Pending
                      </Badge>
                    )}
                  </Group>
                  {member.status === "pending" && member.lastInvitedAt && (
                    <Text size="xs" c="dimmed">
                      Invited {dayjs(member.lastInvitedAt).format("D MMM YYYY, HH:mm")}
                    </Text>
                  )}
                </Stack>
                {member.role === "owner" ? (
                  <Text size="sm" c="dimmed">
                    Owner
                  </Text>
                ) : isOwner ? (
                  <Group gap={4} wrap="nowrap">
                    {member.status === "pending" && (
                      <Tooltip label="Resend invitation">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Resend invitation to ${member.email}`}
                          disabled={busy}
                          onClick={() =>
                            void run(async (client) =>
                              inviteWarning(
                                await client.resend(projectId, member.userId),
                                member.email,
                              ),
                            )
                          }
                        >
                          <IconMailForward size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
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
                          void run(async (client) => {
                            await client.setRole(projectId, member.userId, value);
                            return undefined;
                          });
                        }
                      }}
                    />
                    <Tooltip label="Remove">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Remove ${member.email}`}
                        disabled={busy}
                        onClick={() =>
                          void run(async (client) => {
                            await client.remove(projectId, member.userId);
                            return undefined;
                          })
                        }
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
        {warning && <Alert color="yellow">{warning}</Alert>}

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
              People with an account get access right away. Anyone else gets an email invitation to
              create one.
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
