import { Alert, Anchor, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { safeReturnTo } from "@/auth/redirects";
import { useAuth } from "@/auth/useAuth";
import { trackEvent } from "@/utils/analytics";
import AuthShell from "./AuthShell";

export default function LoginForm() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const { returnTo } = useSearch({ from: "/auth/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await client.signInWithPassword({ email, password });
    setPending(false);
    if (result.error) {
      trackEvent("auth_login_failed");
      setError(
        result.error.code === "rate_limited"
          ? "Too many attempts. Please wait a moment and try again."
          : "Email or password is incorrect.",
      );
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
          {error && <Alert color="red">{error}</Alert>}
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
