import { createFileRoute, redirect } from "@tanstack/react-router";
import LoginForm from "@/components/auth/LoginForm";

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) throw redirect({ to: "/overview" });
  },
  component: LoginForm,
});
