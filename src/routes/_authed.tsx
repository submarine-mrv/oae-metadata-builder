import { Center, Loader } from "@mantine/core";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/auth/useAuth";
import { setPendingVerificationEmail } from "@/auth/verification";

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.status === "loading") return;
    const user = context.auth.user;
    if (!context.auth.isAuthenticated || !user) {
      throw redirect({
        to: "/auth/login",
        search: { error: undefined, returnTo: location.href },
      });
    }
    if (!user.emailVerified) {
      setPendingVerificationEmail(user.email);
      throw redirect({
        to: "/auth/verify-email",
        replace: true,
      });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  return <Outlet />;
}
