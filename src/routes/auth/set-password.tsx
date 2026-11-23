import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeReturnTo } from "@/auth/redirects";
import SetPasswordForm from "@/components/auth/SetPasswordForm";

export const Route = createFileRoute("/auth/set-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.status === "loading") return;
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/auth/login", search: { error: undefined, returnTo: undefined } });
    }
    if (!context.auth.user?.needsPassword) {
      throw redirect({ to: safeReturnTo(search.returnTo) ?? "/overview", replace: true });
    }
  },
  component: SetPasswordPage,
});

function SetPasswordPage() {
  return <SetPasswordForm returnTo={Route.useSearch().returnTo} />;
}
