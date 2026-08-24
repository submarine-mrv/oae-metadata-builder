import { Center, Loader, Stack, Text } from "@mantine/core";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createAuthClient } from "@/auth";
import { markRecoverySession } from "@/auth/authStore";
import { safeReturnTo } from "@/auth/redirects";
import type { AuthResult } from "@/auth/types";
import HomeBrandLink from "@/components/HomeBrandLink";

let exchangedCallbackUrl: string | null = null;
let exchangePromise: Promise<AuthResult> | null = null;

function exchangeCallback(url: string): Promise<AuthResult> {
  if (url === exchangedCallbackUrl && exchangePromise) return exchangePromise;
  exchangedCallbackUrl = url;
  exchangePromise = createAuthClient().exchangeCodeForSession(url);
  return exchangePromise;
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const result = await exchangeCallback(window.location.href);
    if (result.error) {
      // TODO: Dev code
      console.error("Error exchanging code for session:", result);
      if (search.type === "recovery") {
        throw redirect({ to: "/auth/forgot-password", search: { error: "recovery_failed" } });
      }
      throw redirect({
        to: "/auth/login",
        search: { error: result.error.code, returnTo: safeReturnTo(search.returnTo) ?? undefined },
      });
    }
    if (search.type === "recovery") markRecoverySession();
    // TODO: Dev code
    console.log("Successfully exchanged code for session:", result);
    throw redirect({
      to:
        safeReturnTo(search.returnTo) ??
        (search.type === "email_change" ? "/profile" : "/overview"),
      replace: true,
    });
  },
  component: () => (
    <Center py="xl">
      <Stack align="center" gap="lg">
        <HomeBrandLink />
        <div>
          <Text component="span" mr="sm">
            Signing you in
          </Text>
          <Loader size="sm" />
        </div>
      </Stack>
    </Center>
  ),
});
