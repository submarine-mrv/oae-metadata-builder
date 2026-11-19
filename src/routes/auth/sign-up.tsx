import { createFileRoute, redirect } from "@tanstack/react-router";
import SignUpForm from "@/components/auth/SignUpForm";

export const Route = createFileRoute("/auth/sign-up")({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) throw redirect({ to: "/overview" });
  },
  component: SignUpPage,
});

function SignUpPage() {
  return <SignUpForm inviteExpired={Route.useSearch().error === "invite_expired"} />;
}
