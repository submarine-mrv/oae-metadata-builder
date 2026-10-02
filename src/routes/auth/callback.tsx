import { Alert, Center, Loader, Stack, Text } from "@mantine/core";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { safeReturnTo } from "@/auth/redirects";
import type { AuthOtpType } from "@/auth/types";
import { useAuth } from "@/auth/useAuth";
import HomeBrandLink from "@/components/HomeBrandLink";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
    tokenHash: typeof search.token_hash === "string" ? search.token_hash : undefined,
    errorCode: typeof search.error_code === "string" ? search.error_code : undefined,
    errorDescription:
      typeof search.error_description === "string" ? search.error_description : undefined,
    message: typeof search.message === "string" ? search.message : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (search.tokenHash && !search.errorCode && !search.errorDescription && !search.message) {
      return;
    }

    if (search.errorCode || search.errorDescription || search.message) {
      try {
        sessionStorage.setItem(
          "oae-auth-callback-error",
          JSON.stringify({
            type: search.type,
            code: search.errorCode,
            description: search.errorDescription,
            message: search.message,
          }),
        );
      } catch {
        // Continue with the generic error route when session storage is unavailable.
      }
    }

    throw redirect({
      to:
        search.errorCode || search.errorDescription || search.message
          ? search.type === "recovery"
            ? "/auth/forgot-password"
            : search.type === "email_change"
              ? "/profile"
              : "/auth/login"
          : (safeReturnTo(search.returnTo) ??
            (search.type === "email_change" ? "/profile" : "/overview")),
      search:
        search.errorCode || search.errorDescription || search.message
          ? {
              error:
                search.type === "recovery"
                  ? "recovery_failed"
                  : search.type === "email_change"
                    ? "email_change_failed"
                    : undefined,
            }
          : undefined,
      replace: true,
    });
  },
  component: CallbackPage,
});

function CallbackPage() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const exchange =
      search.tokenHash && search.type
        ? (() => {
            const type: AuthOtpType | null = [
              "signup",
              "email",
              "recovery",
              "email_change",
            ].includes(search.type)
              ? (search.type as AuthOtpType)
              : null;
            return type ? client.verifyOtp(search.tokenHash, type) : null;
          })()
        : null;

    if (!exchange) {
      setError(true);
      return () => {
        active = false;
      };
    }

    void exchange.then((result) => {
      if (!active) return;
      if (result.error) {
        try {
          sessionStorage.setItem(
            "oae-auth-callback-error",
            JSON.stringify({ type: search.type, code: result.error.code }),
          );
        } catch {
          // Continue with the destination's generic error state when storage is unavailable.
        }
        const destination =
          search.type === "recovery"
            ? { to: "/auth/forgot-password", search: { error: "recovery_failed" } }
            : search.type === "email_change"
              ? { to: "/profile", search: { error: "email_change_failed" } }
              : { to: "/auth/login", search: { error: undefined, returnTo: undefined } };
        void navigate({ ...destination, replace: true });
        return;
      }
      const destination =
        safeReturnTo(search.returnTo) ??
        (search.type === "recovery"
          ? "/auth/reset-password"
          : search.type === "email_change"
            ? "/profile"
            : "/overview");
      void navigate({
        to: destination,
        ...(search.type === "recovery" && destination === "/auth/reset-password"
          ? { search: { type: "recovery" } }
          : {}),
        replace: true,
      });
    });
    return () => {
      active = false;
    };
  }, [client, navigate, search.returnTo, search.tokenHash, search.type]);

  return (
    <Center py="xl">
      <Stack align="center" gap="lg">
        <HomeBrandLink />
        {error ? (
          <Alert color="red">This authentication link is invalid or has expired.</Alert>
        ) : (
          <div>
            <Text component="span" mr="sm">
              Signing you in
            </Text>
            <Loader size="sm" />
          </div>
        )}
      </Stack>
    </Center>
  );
}
