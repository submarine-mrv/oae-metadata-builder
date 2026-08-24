import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Progress,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { trackEvent } from "@/utils/analytics";
import AuthShell from "./AuthShell";

export default function SignUpForm() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", displayName: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const strength =
    [
      form.password.length >= 8,
      /[a-z]/.test(form.password),
      /[A-Z]/.test(form.password),
      /\d/.test(form.password),
    ].filter(Boolean).length * 25;

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (strength < 100) {
      setError("Use at least 8 characters with lowercase, uppercase, and a number.");
      return;
    }
    setPending(true);
    const result = await client.signUpWithPassword({
      email: form.email,
      password: form.password,
      displayName: form.displayName || undefined,
    });
    setPending(false);
    if (result.error) {
      setError(
        result.error.code === "rate_limited"
          ? "Too many attempts. Please wait and try again."
          : "We could not create that account. Check your details and try again.",
      );
      return;
    }
    trackEvent("auth_signup_completed");
    await navigate({ to: "/auth/verify-email", search: { email: form.email } });
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="Keep your metadata work ready for the next step."
      footer={
        <>
          Already registered?{" "}
          <Anchor component={Link} to="/auth/login">
            Log in
          </Anchor>
        </>
      }
    >
      <form onSubmit={submit}>
        <Stack>
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Display name"
            autoComplete="name"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.currentTarget.value })}
          />
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
          />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.currentTarget.value })}
          />
          <Progress value={strength} color={strength === 100 ? "teal" : "coral"} size="sm" />
          <Text size="xs" c="dimmed">
            Use 8+ characters, including lowercase, uppercase, and a number.
          </Text>
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.currentTarget.value })}
          />
          <Button type="submit" loading={pending} color="coral">
            Create account
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
