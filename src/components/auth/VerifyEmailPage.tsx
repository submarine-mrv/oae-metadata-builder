import { Alert, Button, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buildAuthRedirectUrl } from "@/auth/redirects";
import { useAuth } from "@/auth/useAuth";
import { useResendCooldown } from "@/auth/useResendCooldown";
import AuthShell from "./AuthShell";

interface VerifyEmailPageProps {
  email: string;
}

export default function VerifyEmailPage({ email }: VerifyEmailPageProps) {
  const { client, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const cooldown = useResendCooldown();

  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      void navigate({ to: "/overview", replace: true });
    }
  }, [isAuthenticated, navigate, user?.emailVerified]);

  async function resend() {
    if (cooldown.remaining > 0) return;
    setPending(true);
    const result = await client.resendVerification(
      email,
      buildAuthRedirectUrl({ type: "signup", returnTo: "/overview" }),
    );
    setPending(false);
    if (!result.error) cooldown.start();
    setMessage(
      result.error
        ? "Please wait before requesting another email."
        : "A new verification email is on its way.",
    );
  }

  return (
    <AuthShell
      title="Check your inbox"
      subtitle="One more step to verify your email address."
      footer={<span>You can close this page after requesting the email.</span>}
    >
      <Stack>
        <Title order={3}>Verification email sent</Title>
        <Text size="sm">
          Open the link in the email sent to your address. Please check your inbox and verify your
          email address before accessing the dashboard.
        </Text>
        {message && <Alert color="teal">{message}</Alert>}
        <Text size="sm" fw={500}>
          {email}
        </Text>
        <Button onClick={resend} loading={pending} disabled={cooldown.remaining > 0} color="coral">
          {cooldown.remaining > 0
            ? `Resend in ${cooldown.remaining}s`
            : "Resend verification email"}
        </Button>
      </Stack>
    </AuthShell>
  );
}
