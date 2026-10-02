import { createFileRoute, redirect } from "@tanstack/react-router";
import SignUpForm from "@/components/auth/SignUpForm";

export const Route = createFileRoute("/auth/sign-up")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) throw redirect({ to: "/overview" });
  },
  component: SignUpForm,
});
