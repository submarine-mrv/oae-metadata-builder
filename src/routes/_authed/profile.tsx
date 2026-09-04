import {
  Alert,
  Button,
  Container,
  Divider,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import HomeBrandLink from "@/components/HomeBrandLink";

export const Route = createFileRoute("/_authed/profile")({ component: ProfilePage });

function ProfilePage() {
  const { client, profile, user, setProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [organization, setOrganization] = useState(profile?.organization ?? "");
  const [orcid, setOrcid] = useState(profile?.orcid ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setOrganization(profile?.organization ?? "");
    setOrcid(profile?.orcid ?? "");
  }, [profile]);

  async function saveProfile(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await client.updateProfile({ displayName, organization, orcid });
      setProfile(result);
      setMessage("Profile saved.");
    } catch {
      setMessage("We could not save your profile.");
    } finally {
      setPending(false);
    }
  }

  async function changePassword(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);
    const reauthenticated = await client.signInWithPassword({
      email: user?.email ?? "",
      password: currentPassword,
    });
    if (reauthenticated.error) {
      setPending(false);
      setMessage("Current password is incorrect.");
      return;
    }
    const result = await client.updatePassword(newPassword);
    setPending(false);
    setMessage(result.error ? "We could not update your password." : "Password updated.");
    if (!result.error) {
      setCurrentPassword("");
      setNewPassword("");
    }
  }

  async function changeEmail(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);
    const reauthenticated = await client.signInWithPassword({
      email: user?.email ?? "",
      password: currentPassword,
    });
    if (reauthenticated.error) {
      setPending(false);
      setMessage("Current password is incorrect.");
      return;
    }
    const result = await client.updateEmail(
      newEmail,
      `${window.location.origin}/auth/callback?type=email_change&returnTo=/profile`,
    );
    setPending(false);
    setMessage(
      result.error
        ? "We could not start the email change."
        : "Check both email addresses to confirm the change.",
    );
    if (!result.error) {
      setNewEmail("");
      setCurrentPassword("");
    }
  }

  async function logout() {
    await client.signOut();
    await navigate({ to: "/auth/login", search: { error: undefined, returnTo: undefined } });
  }

  function openDeleteModal() {
    setDeleteConfirmEmail("");
    setDeleteError(null);
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase()) {
      setDeleteError("Email does not match your account.");
      return;
    }
    setDeleteError(null);
    setDeletePending(true);
    const result = await client.deleteAccount();
    if (result.error) {
      setDeletePending(false);
      setDeleteError("We could not delete your account. Please try again.");
      return;
    }
    // The account is already gone server-side; sign out locally only, revoking
    // it server-side would fail since the underlying user no longer exists.
    await client.signOut("local");
    setDeletePending(false);
    setDeleteModalOpen(false);
    // TODO: Not the best UI but works for now
    notifications.show({
      message: "Your account has been deleted.",
      color: "teal",
      autoClose: 5000,
    });
    await navigate({ to: "/auth/login", search: { error: undefined, returnTo: undefined } });
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <HomeBrandLink />
        <Stack gap={4}>
          <Title order={1}>Profile</Title>
          <div>{user?.email}</div>
        </Stack>
        {message && (
          <Alert color="teal" withCloseButton onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}
        <form onSubmit={saveProfile}>
          <Stack>
            <TextInput
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
            <TextInput
              label="Organization"
              value={organization}
              onChange={(event) => setOrganization(event.currentTarget.value)}
            />
            <TextInput
              label="ORCID"
              placeholder="0000-0000-0000-0000"
              value={orcid}
              onChange={(event) => setOrcid(event.currentTarget.value)}
            />
            <Button type="submit" loading={pending} color="coral">
              Save profile
            </Button>
          </Stack>
        </form>
        <Divider />
        <form onSubmit={changeEmail}>
          <Stack>
            <Title order={2}>Change email</Title>
            <TextInput
              label="New email"
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.currentTarget.value)}
            />
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.currentTarget.value)}
            />
            <Button type="submit" loading={pending} color="coral">
              Send confirmation emails
            </Button>
          </Stack>
        </form>
        <Divider />
        <form onSubmit={changePassword}>
          <Stack>
            <Title order={2}>Security</Title>
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.currentTarget.value)}
            />
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.currentTarget.value)}
            />
            <Button type="submit" loading={pending} color="coral">
              Change password
            </Button>
          </Stack>
        </form>
        <Divider />
        <Stack>
          <Title order={2}>Account</Title>
          <Button variant="default" onClick={logout} style={{ alignSelf: "flex-start" }}>
            Log out
          </Button>
          <Button
            color="red"
            variant="outline"
            onClick={openDeleteModal}
            style={{ alignSelf: "flex-start" }}
          >
            Delete account
          </Button>
        </Stack>
      </Stack>
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete account"
      >
        <Stack>
          <Alert color="red">This permanently deletes your account and cannot be undone.</Alert>
          <Text size="sm">
            Type <strong>{user?.email}</strong> to confirm.
          </Text>
          {deleteError && <Alert color="red">{deleteError}</Alert>}
          <TextInput
            label="Confirm email"
            autoComplete="off"
            value={deleteConfirmEmail}
            onChange={(event) => setDeleteConfirmEmail(event.currentTarget.value)}
          />
          <Button
            color="red"
            loading={deletePending}
            disabled={deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase()}
            onClick={confirmDelete}
          >
            Delete account
          </Button>
        </Stack>
      </Modal>
    </Container>
  );
}
