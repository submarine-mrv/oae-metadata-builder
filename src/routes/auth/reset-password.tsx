import { createFileRoute, redirect } from "@tanstack/react-router";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const Route = createFileRoute("/auth/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: typeof search.type === "string" ? search.type : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.status === "loading") return;
    if (!context.auth.isAuthenticated || search.type !== "recovery") {
      throw redirect({ to: "/auth/forgot-password", search: { error: undefined } });
    }
  },
  component: ResetPasswordForm,
});
