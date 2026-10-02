import { Alert, Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { mapAuthError } from "@/auth/errors";
import { buildAuthRedirectUrl } from "@/auth/redirects";
import type { AuthErrorCode } from "@/auth/types";
import { useAuth } from "@/auth/useAuth";
import { trackEvent } from "@/utils/analytics";
import AuthShell from "./AuthShell";

type ErrorMessages = Partial<Record<AuthErrorCode, string>> & { unknown: string };

const ERROR_MESSAGES: ErrorMessages = {
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  expired_link: "This reset link has expired. Request a new one.",
  network: "Network error. Check your connection and try again.",
  unknown: "Something went wrong. Please try again.",
};

function getErrorMessage(code: AuthErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
}

function readCallbackError(): AuthErrorCode | null {
  try {
    const stored = sessionStorage.getItem("oae-auth-callback-error");
    sessionStorage.removeItem("oae-auth-callback-error");
    if (!stored) return null;

    const payload = JSON.parse(stored) as {
      code?: unknown;
      description?: unknown;
      message?: unknown;
    };
    return (
      mapAuthError({
        code: typeof payload.code === "string" ? payload.code : undefined,
        message:
          typeof payload.description === "string"
            ? payload.description
            : typeof payload.message === "string"
              ? payload.message
              : undefined,
      })?.code ?? null
    );
  } catch {
    return null;
  }
}

export default function ForgotPasswordForm({ error }: { error?: string }) {
  const { client } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [recoveryErrorCode] = useState<AuthErrorCode | null>(() => readCallbackError());
  const [showRecoveryError, setShowRecoveryError] = useState(
    error === "recovery_failed" || recoveryErrorCode !== null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setPending(true);
    const result = await client.sendPasswordReset(
      email,
      buildAuthRedirectUrl({
        type: "recovery",
        returnTo: "/auth/reset-password?type=recovery",
      }),
    );
    setPending(false);
    if (result.error) {
      setSubmitError(getErrorMessage(result.error.code));
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
              {recoveryErrorCode
                ? getErrorMessage(recoveryErrorCode)
                : "We could not verify that reset link. It might have expired, please try again."}
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
