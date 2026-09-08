import { Center, Loader } from "@mantine/core";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.status === "loading") return;
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/auth/login",
        search: { error: undefined, returnTo: location.href },
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
