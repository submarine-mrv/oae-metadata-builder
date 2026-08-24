import { Alert, Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { AuthErrorCode } from "@/auth/types";
import { useAuth } from "@/auth/useAuth";
import { trackEvent } from "@/utils/analytics";
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

export default function ForgotPasswordForm({ error }: { error?: string }) {
  const { client } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [showRecoveryError, setShowRecoveryError] = useState(error === "recovery_failed");
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setPending(true);
    const result = await client.sendPasswordReset(
      email,
      `${window.location.origin}/auth/callback?type=recovery&returnTo=/auth/reset-password?type=recovery`,
    );
    setPending(false);
    if (result.error) {
      setSubmitError(ERROR_MESSAGES[result.error.code]);
      return;
    }
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
              We could not verify that reset link. It might have expired, please try again. Contact
              the administrator (data@carbontosea.org) if the issue persists.
            </Alert>
          )}
          {submitError && <Alert color="red">{submitError}</Alert>}
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
