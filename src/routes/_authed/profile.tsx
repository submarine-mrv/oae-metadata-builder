import {
  Alert,
  Button,
  Container,
  Divider,
  Group,
  Modal,
  Paper,
  PasswordInput,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPasswordUpdateErrorMessage, getReauthErrorMessage } from "@/auth/errors";
import { getPasswordStrength } from "@/auth/passwordStrength";
import { buildAuthRedirectUrl } from "@/auth/redirects";
import { useAuth } from "@/auth/useAuth";
import AppLayout from "@/components/AppLayout";

export const Route = createFileRoute("/_authed/profile")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: () => <ProfilePage error={Route.useSearch().error} />,
});

const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function ProfilePage({ error }: { error?: string }) {
  const { client, profile, user, setProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [organization, setOrganization] = useState(profile?.organization ?? "");
  const [orcid, setOrcid] = useState(profile?.orcid ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [profileCallbackError] = useState<string | null>(
    error === "email_change_failed"
      ? "The email change link could not be verified. Request a new confirmation from Account."
      : null,
  );
  const [profilePending, setProfilePending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setOrganization(profile?.organization ?? "");
    setOrcid(profile?.orcid ?? "");
  }, [profile]);

  async function saveProfile(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    if (orcid && !ORCID_PATTERN.test(orcid)) {
      setProfileError("ORCID must be in the format 0000-0000-0000-0000.");
      return;
    }
    setProfilePending(true);
    try {
      const result = await client.updateProfile({ displayName, organization, orcid });
      setProfile(result);
      setProfileSuccess("Profile saved.");
    } catch {
      setProfileError("We could not save your profile.");
    } finally {
      setProfilePending(false);
    }
  }

  async function changePassword(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (passwordStrength < 100) {
      setPasswordError("Use at least 8 characters with lowercase, uppercase, and a number.");
      return;
    }
    setPasswordPending(true);
    const reauthenticated = await client.signInWithPassword({
      email: user?.email ?? "",
      password: currentPassword,
    });
    if (reauthenticated.error) {
      setPasswordPending(false);
      setPasswordError(getReauthErrorMessage(reauthenticated.error.code));
      return;
    }
    const result = await client.updatePassword(newPassword);
    setPasswordPending(false);
    if (result.error) {
      setPasswordError(getPasswordUpdateErrorMessage(result.error.code));
      return;
    }
    closePasswordModal();
    setPasswordSuccess("Password updated.");
  }

  function closeEmailModal() {
    setEmailModalOpen(false);
    setNewEmail("");
    setEmailError(null);
  }

  function openEmailModal() {
    setEmailError(null);
    setEmailSuccess(null);
    setEmailModalOpen(true);
  }

  async function confirmEmailChange(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setEmailError("New email must be different from your current email.");
      return;
    }
    setEmailPending(true);
    const result = await client.updateEmail(
      newEmail.trim(),
      buildAuthRedirectUrl({ type: "email_change", returnTo: "/profile" }),
    );
    setEmailPending(false);
    if (result.error) {
      setEmailError("We could not start the email change.");
      return;
    }
    closeEmailModal();
    setEmailSuccess("Check your new email address to confirm the change.");
  }

  function closePasswordModal() {
    setPasswordModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError(null);
  }

  function openPasswordModal() {
    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordModalOpen(true);
  }

  async function logout() {
    setLogoutPending(true);
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
    await client.signOut("local");
    setDeletePending(false);
    setDeleteModalOpen(false);
    notifications.show({
      message: "Your account has been deleted.",
      color: "teal",
      autoClose: 5000,
    });
    await navigate({ to: "/auth/login", search: { error: undefined, returnTo: undefined } });
  }

  return (
    <AppLayout>
      <Container size="sm" py="xl">
        <Stack gap="xl">
          <Stack gap={4}>
            <Title order={1}>Profile</Title>
            <Text c="dimmed">Manage your profile details and account settings.</Text>
          </Stack>
          {profileCallbackError && <Alert color="red">{profileCallbackError}</Alert>}
          {profileError && (
            <Alert color="red" withCloseButton onClose={() => setProfileError(null)}>
              {profileError}
            </Alert>
          )}
          {profileSuccess && (
            <Alert color="teal" withCloseButton onClose={() => setProfileSuccess(null)}>
              {profileSuccess}
            </Alert>
          )}
          {emailSuccess && (
            <Alert color="teal" withCloseButton onClose={() => setEmailSuccess(null)}>
              {emailSuccess}
            </Alert>
          )}
          {passwordSuccess && (
            <Alert color="teal" withCloseButton onClose={() => setPasswordSuccess(null)}>
              {passwordSuccess}
            </Alert>
          )}
          <Paper withBorder p="xl">
            <form onSubmit={saveProfile}>
              <Stack>
                <Title order={2}>Profile details</Title>
                <TextInput
                  label="Full name"
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
                  error={
                    orcid && !ORCID_PATTERN.test(orcid) ? "Format: 0000-0000-0000-0000" : undefined
                  }
                />
                <Button type="submit" loading={profilePending} color="coral">
                  Save profile
                </Button>
              </Stack>
            </form>
          </Paper>
          <Paper withBorder p="xl">
            <Stack>
              <Title order={2}>Account</Title>
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={500}>Email</Text>
                  <Text size="sm" c="dimmed">
                    {user?.email}
                  </Text>
                </div>
                <Button type="button" variant="light" onClick={openEmailModal}>
                  Change email
                </Button>
              </Group>
              <Divider />
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={500}>Password</Text>
                  <Text size="sm" c="dimmed">
                    Update your account password.
                  </Text>
                </div>
                <Button type="button" variant="light" onClick={openPasswordModal}>
                  Change password
                </Button>
              </Group>
              <Divider />
              <Group>
                <Button type="button" variant="default" loading={logoutPending} onClick={logout}>
                  Log out
                </Button>
                <Button type="button" color="red" variant="outline" onClick={openDeleteModal}>
                  Delete account
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Container>
      <Modal opened={emailModalOpen} onClose={closeEmailModal} title="Change email">
        <form onSubmit={confirmEmailChange}>
          <Stack>
            {emailError && <Alert color="red">{emailError}</Alert>}
            <TextInput
              label="New email"
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.currentTarget.value)}
            />
            <Text size="sm">You will confirm the change from your new email address.</Text>
            <Button type="submit" loading={emailPending} color="coral">
              Send confirmation email
            </Button>
          </Stack>
        </form>
      </Modal>
      <Modal opened={passwordModalOpen} onClose={closePasswordModal} title="Change password">
        <form onSubmit={changePassword}>
          <Stack>
            {passwordError && <Alert color="red">{passwordError}</Alert>}
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
            <Progress
              value={passwordStrength}
              color={passwordStrength === 100 ? "teal" : "coral"}
              size="sm"
            />
            <Text size="xs" c="dimmed">
              Use 8+ characters, including lowercase, uppercase, and a number.
            </Text>
            <PasswordInput
              label="Confirm new password"
              autoComplete="new-password"
              required
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.currentTarget.value)}
            />
            <Button type="submit" loading={passwordPending} color="coral">
              Change password
            </Button>
          </Stack>
        </form>
      </Modal>
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
            type="button"
            color="red"
            loading={deletePending}
            disabled={deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase()}
            onClick={confirmDelete}
          >
            Delete account
          </Button>
        </Stack>
      </Modal>
    </AppLayout>
  );
}
