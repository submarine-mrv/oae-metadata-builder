import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPendingVerificationEmail } from "@/auth/verification";
import VerifyEmailPage from "@/components/auth/VerifyEmailPage";

export const Route = createFileRoute("/auth/verify-email")({
  beforeLoad: ({ context }) => {
    const pendingEmail = getPendingVerificationEmail();

    if (context.auth.status === "loading") {
      return { email: pendingEmail };
    }

    if (context.auth.isAuthenticated && context.auth.user?.emailVerified) {
      throw redirect({ to: "/overview", replace: true });
    }

    const email = pendingEmail || context.auth.user?.email || "";
    if (!email) {
      throw redirect({
        to: "/auth/login",
        search: { error: undefined, returnTo: undefined },
        replace: true,
      });
    }

    return { email };
  },
  component: VerifyEmailRoute,
});

function VerifyEmailRoute() {
  const { email } = Route.useRouteContext();
  if (!email) return null;
  return <VerifyEmailPage email={email} />;
}
