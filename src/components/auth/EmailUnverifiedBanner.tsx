import { Alert, Anchor, Button, Group } from "@mantine/core";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { useResendCooldown } from "@/auth/useResendCooldown";

const dismissedKey = "oae-auth-unverified-dismissed";

export default function EmailUnverifiedBanner() {
  const { client, user } = useAuth();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(dismissedKey) === "true");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const cooldown = useResendCooldown();

  if (!user || user.emailVerified || dismissed) return null;
  const email = user.email;

  async function resend() {
    if (cooldown.remaining > 0) return;
    setPending(true);
    const result = await client.resendVerification(
      email,
      `${window.location.origin}/auth/callback?type=signup&returnTo=/overview`,
    );
    setPending(false);
    if (!result.error) cooldown.start();
    setMessage(
      result.error ? "Please wait before requesting another email." : "Verification email sent.",
    );
  }

  function dismiss() {
    sessionStorage.setItem(dismissedKey, "true");
    setDismissed(true);
  }

  return (
    <Alert color="yellow" title="Verify your email" withCloseButton onClose={dismiss}>
      Password reset and account recovery require a verified email.{" "}
      {message ? (
        message
      ) : (
        <Group gap="xs" mt="xs">
          <Button
            size="compact-sm"
            variant="light"
            loading={pending}
            disabled={cooldown.remaining > 0}
            onClick={resend}
          >
            {cooldown.remaining > 0
              ? `Resend in ${cooldown.remaining}s`
              : "Resend verification email"}
          </Button>
          <Anchor component="button" type="button" size="sm" onClick={dismiss}>
            Dismiss
          </Anchor>
        </Group>
      )}
    </Alert>
  );
}
