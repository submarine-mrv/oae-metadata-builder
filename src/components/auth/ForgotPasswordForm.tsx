import { Alert, Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { trackEvent } from "@/utils/analytics";
import AuthShell from "./AuthShell";

export default function ForgotPasswordForm({ error }: { error?: string }) {
  const { client } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [showRecoveryError, setShowRecoveryError] = useState(error === "recovery_failed");

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    await client.sendPasswordReset(
      email,
      `${window.location.origin}/auth/callback?type=recovery&returnTo=/auth/reset-password?type=recovery`,
    );
    setPending(false);
    setSent(true);
    trackEvent("auth_password_reset_requested");
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will send instructions if an account exists for that email."
      footer={
        <Anchor component={Link} to="/auth/login">
          Back to log in
        </Anchor>
      }
    >
      <form onSubmit={submit}>
        <Stack>
          {showRecoveryError && (
            <Alert color="red" withCloseButton onClose={() => setShowRecoveryError(false)}>
              We could not verify that reset link. Please contact the administrator for help.
            </Alert>
          )}
          {sent && (
            <Alert color="teal">
              If an account exists for that address, we have sent a reset link.
            </Alert>
          )}
          {!sent && (
            <Text size="sm">
              Enter your account email and check your inbox for a secure reset link.
            </Text>
          )}
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <Button type="submit" loading={pending} color="coral">
            Send reset link
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
