import {
  Alert,
  Button,
  Container,
  Divider,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import HomeBrandLink from "@/components/HomeBrandLink";

export const Route = createFileRoute("/_authed/profile")({ component: ProfilePage });

function ProfilePage() {
  const { client, profile, user } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [organization, setOrganization] = useState(profile?.organization ?? "");
  const [orcid, setOrcid] = useState(profile?.orcid ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setOrganization(profile?.organization ?? "");
    setOrcid(profile?.orcid ?? "");
  }, [profile]);

  async function saveProfile(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await client.updateProfile({ displayName, organization, orcid });
    setPending(false);
    setMessage(result ? "Profile saved." : "We could not save your profile.");
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

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <HomeBrandLink />
        <Stack gap={4}>
          <Title order={1}>Profile</Title>
          <div>{user?.email}</div>
        </Stack>
        {message && <Alert color="teal">{message}</Alert>}
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
      </Stack>
    </Container>
  );
}
