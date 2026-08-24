import { createFileRoute } from "@tanstack/react-router";
import VerifyEmailPage from "@/components/auth/VerifyEmailPage";

export const Route = createFileRoute("/auth/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
  }),
  component: () => <VerifyEmailPage email={Route.useSearch().email} />,
});
