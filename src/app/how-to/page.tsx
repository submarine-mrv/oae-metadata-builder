"use client";
import React from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Paper
} from "@mantine/core";
import Navigation from "@/components/Navigation";

export default function HowToPage() {
  return (
    <>
      <Navigation />
      <Container size="md" py="xl">
        <Stack gap="lg">
          <div>
            <Title order={1}>How-to Guide</Title>
            <Text c="dimmed" mt="sm">
              Understanding the ODP Metadata Builder Workflow
            </Text>
          </div>

          <Paper shadow="sm" p="xl" withBorder>
            <Stack gap="xl">
              <div>
                <Text>TBD</Text>
              </div>

              <div>
                <Title order={2} size="h3" mb="sm">
                  When to Use This Tool
                </Title>
                <Text mb="md">
                  At the point of uploading a dataset to a repository,
                  researchers should use this tool to create an{" "}
                  <strong>odp_metadata.json</strong> file...
                </Text>
              </div>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </>
  );
}
