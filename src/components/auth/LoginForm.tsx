import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { COMMON_AUTH_ERROR_MESSAGES } from "@/auth/errors";
import { safeReturnTo } from "@/auth/redirects";
import type { AuthErrorCode } from "@/auth/types";
import { useAuth } from "@/auth/useAuth";
import { setPendingVerificationEmail } from "@/auth/verification";
import { trackEvent } from "@/utils/analytics";
import AuthShell from "./AuthShell";

const LOGIN_ERROR_MESSAGES: Partial<Record<AuthErrorCode, string>> = {
  ...COMMON_AUTH_ERROR_MESSAGES,
  email_not_confirmed: "Email is not confirmed.",
  unknown: "We could not log you in right now. Please try again.",
};

export default function LoginForm() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const { returnTo } = useSearch({ from: "/auth/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrorCode(null);
    setPending(true);
    const result = await client.signInWithPassword({ email, password });
    setPending(false);
    if (result.error) {
      trackEvent("auth_login_failed");
      setErrorCode(result.error.code);
      setError(LOGIN_ERROR_MESSAGES[result.error.code] ?? "Email or password is incorrect.");
      return;
    }
    trackEvent("auth_login_succeeded");
    await navigate({ to: safeReturnTo(returnTo) ?? "/overview" });
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Access your metadata workspace."
      footer={
        <>
          New here?{" "}
          <Anchor component={Link} to="/auth/sign-up">
            Create an account
          </Anchor>
        </>
      }
    >
      <form onSubmit={submit}>
        <Stack>
          {error && (
            <Alert color="red">
              <Stack gap={4}>
                <Text>{error}</Text>
                {errorCode === "email_not_confirmed" && email && (
                  <Anchor
                    href="/auth/verify-email"
                    onClick={() => setPendingVerificationEmail(email)}
                  >
                    Confirm email or resend verification
                  </Anchor>
                )}
              </Stack>
            </Alert>
          )}
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <Anchor component={Link} to="/auth/forgot-password" size="sm" ta="right">
            Forgot password?
          </Anchor>
          <Button type="submit" loading={pending} color="coral">
            Log in
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
