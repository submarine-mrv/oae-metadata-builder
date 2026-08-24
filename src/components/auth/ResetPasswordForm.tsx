import { Alert, Anchor, Button, PasswordInput, Stack } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { AuthErrorCode } from "@/auth/types";
import { useAuth } from "@/auth/useAuth";
import AuthShell from "./AuthShell";

const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  weak_password:
    "Choose a stronger password. Must contain at least 8 characters, including a small letter, a capital letter, and a number",
  same_password: "New password must be different from your old password.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  expired_link: "This reset link has expired. Request a new one.",
  network: "Network error. Check your connection and try again.",
  invalid_credentials: "This reset link is no longer valid.",
  email_not_confirmed: "This reset link is no longer valid.",
  email_taken: "This reset link is no longer valid.",
  unknown: "Something went wrong. Please try again.",
};

export default function ResetPasswordForm() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    const result = await client.updatePassword(password);
    setPending(false);
    if (result.error) {
      setError(ERROR_MESSAGES[result.error.code]);
      return;
    }
    await client.signOut("global");
    await navigate({ to: "/auth/login", search: { error: undefined, returnTo: undefined } });
  }

  async function cancel() {
    setCancelling(true);
    await client.signOut("global");
    await navigate({ to: "/auth/login", search: { error: undefined, returnTo: undefined } });
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your new password will protect your account on all devices."
      footer={
        <Anchor component="button" type="button" disabled={cancelling} onClick={cancel}>
          Back to log in
        </Anchor>
      }
    >
      <form onSubmit={submit}>
        <Stack>
          {error && <Alert color="red">{error}</Alert>}
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.currentTarget.value)}
          />
          <Button type="submit" loading={pending} disabled={cancelling} color="coral">
            Update password
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
