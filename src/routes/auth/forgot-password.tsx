import { createFileRoute, redirect } from "@tanstack/react-router";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const Route = createFileRoute("/auth/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated && !search.error) throw redirect({ to: "/overview" });
  },
  component: () => <ForgotPasswordForm error={Route.useSearch().error} />,
});
