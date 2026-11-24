import { Alert, Anchor, Button, PasswordInput, Progress, Stack, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getPasswordUpdateErrorMessage } from "@/auth/errors";
import { getPasswordStrength } from "@/auth/passwordStrength";
import { safeReturnTo } from "@/auth/redirects";
import { useAuth } from "@/auth/useAuth";
import AuthShell from "./AuthShell";

/** First password for an invited account; the rest of the app waits until it's set. */
export default function SetPasswordForm({ returnTo }: { returnTo?: string }) {
  const { client, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const strength = getPasswordStrength(password);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (strength < 100) {
      setError("Use at least 8 characters with lowercase, uppercase, and a number.");
      return;
    }
    setPending(true);
    const result = await client.updatePassword(password);
    setPending(false);
    if (result.error) {
      // Supabase refuses a password change on a session older than a day without reauthenticating.
      setExpired(result.error.code === "reauthentication_needed");
      setError(getPasswordUpdateErrorMessage(result.error.code));
      return;
    }
    await navigate({ to: safeReturnTo(returnTo) ?? "/overview", replace: true });
  }

  async function signOut(to: "/auth/login" | "/auth/forgot-password" = "/auth/login") {
    setSigningOut(true);
    await client.signOut("local");
    await navigate(
      to === "/auth/login"
        ? { to, search: { error: undefined, returnTo: undefined } }
        : { to, search: { error: undefined } },
    );
  }

  return (
    <AuthShell
      title="Set your password"
      subtitle={
        user?.email
          ? `Choose a password to finish setting up ${user.email}.`
          : "Choose a password to finish setting up your account."
      }
      footer={
        <Anchor
          component="button"
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          Sign out
        </Anchor>
      }
    >
      <form onSubmit={submit}>
        <Stack>
          {error && (
            <Alert color="red">
              {expired ? (
                <>
                  This sign-in is too old to set a password.{" "}
                  <Anchor
                    component="button"
                    type="button"
                    disabled={signingOut}
                    onClick={() => void signOut("/auth/forgot-password")}
                  >
                    Request a password reset link
                  </Anchor>{" "}
                  instead.
                </>
              ) : (
                error
              )}
            </Alert>
          )}
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <Progress value={strength} color={strength === 100 ? "teal" : "coral"} size="sm" />
          <Text size="xs" c="dimmed">
            Use 8+ characters, including lowercase, uppercase, and a number.
          </Text>
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.currentTarget.value)}
          />
          <Button type="submit" loading={pending} disabled={signingOut} color="coral">
            Set password and continue
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
