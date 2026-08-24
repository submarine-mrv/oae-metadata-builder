import { Alert, Button, PasswordInput, Stack } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import AuthShell from "./AuthShell";

export default function ResetPasswordForm() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      setError(
        result.error.code === "rate_limited"
          ? "Too many attempts. Please wait a moment and try again."
          : result.error.code === "weak_password"
            ? "Choose a stronger password."
            : "This reset link is no longer valid.",
      );
      return;
    }
    await client.signOut("global");
    await navigate({ to: "/auth/login", search: { error: undefined, returnTo: undefined } });
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your new password will protect your account on all devices."
      footer={null}
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
          <Button type="submit" loading={pending} color="coral">
            Update password
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
