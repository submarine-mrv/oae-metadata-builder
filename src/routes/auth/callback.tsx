import { Center, Loader, Stack, Text } from "@mantine/core";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeReturnTo } from "@/auth/redirects";
import HomeBrandLink from "@/components/HomeBrandLink";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
  }),
  beforeLoad: async ({ search }) => {
    throw redirect({
      to:
        safeReturnTo(search.returnTo) ??
        (search.type === "email_change" ? "/profile" : "/overview"),
      replace: true,
    });
  },
  component: () => (
    <Center py="xl">
      <Stack align="center" gap="lg">
        <HomeBrandLink />
        <div>
          <Text component="span" mr="sm">
            Signing you in
          </Text>
          <Loader size="sm" />
        </div>
      </Stack>
    </Center>
  ),
});
