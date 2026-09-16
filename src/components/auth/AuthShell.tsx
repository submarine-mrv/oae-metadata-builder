import { Container, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import HomeBrandLink from "@/components/HomeBrandLink";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <Container size={420} py="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <HomeBrandLink />
          <Title order={1}>{title}</Title>
          <Text c="dimmed">{subtitle}</Text>
        </Stack>
        <Paper withBorder shadow="sm" p="xl" radius="md">
          {children}
        </Paper>
        <Text size="sm" ta="center">
          {footer}
        </Text>
      </Stack>
    </Container>
  );
}
