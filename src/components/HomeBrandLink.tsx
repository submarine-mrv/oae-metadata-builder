import { Group, Image, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";

export default function HomeBrandLink() {
  return (
    <Link
      to="/overview"
      aria-label="Back to OAE Metadata Builder home"
      style={{ textDecoration: "none" }}
    >
      <Group gap="sm">
        <Image src="/cts-logo.png" alt="Carbon to Sea" h={32} w="auto" />
        <Text fw={500} size="md" c="hadal.9" ff="var(--font-display)">
          OAE Metadata Builder
        </Text>
      </Group>
    </Link>
  );
}
