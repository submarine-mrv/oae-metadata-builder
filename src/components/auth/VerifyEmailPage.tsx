import { Alert, Button, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { useResendCooldown } from "@/auth/useResendCooldown";
import AuthShell from "./AuthShell";

interface VerifyEmailPageProps {
  email: string;
}

export default function VerifyEmailPage({ email }: VerifyEmailPageProps) {
  const { client } = useAuth();
  const [address, setAddress] = useState(email);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const cooldown = useResendCooldown();

  async function resend() {
    if (cooldown.remaining > 0) return;
    setPending(true);
    const result = await client.resendVerification(
      address,
      `${window.location.origin}/auth/callback?type=signup&returnTo=/overview`,
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
      footer={<Text size="sm">You can close this page after requesting the email.</Text>}
    >
      <Stack>
        <Title order={3}>Verification email sent</Title>
        <Text size="sm">
          Open the link in the email sent to {email || "your address"}. You can use the app while
          your email is unverified.
        </Text>
        {message && <Alert color="teal">{message}</Alert>}
        <TextInput
          label="Email"
          type="email"
          value={address}
          onChange={(event) => setAddress(event.currentTarget.value)}
        />
        <Button onClick={resend} loading={pending} disabled={cooldown.remaining > 0} color="coral">
          {cooldown.remaining > 0
            ? `Resend in ${cooldown.remaining}s`
            : "Resend verification email"}
        </Button>
      </Stack>
    </AuthShell>
  );
}
