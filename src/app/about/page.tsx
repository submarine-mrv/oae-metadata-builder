"use client";
import React from "react";
import { Container, Title, Text, Stack, Paper, Anchor } from "@mantine/core";
import AppLayout from "@/components/AppLayout";

export default function AboutPage() {
  return (
    <AppLayout>
      <Container size="md" py="xl">
        <Stack gap="lg">
          <div>
            <Title order={1}>About ODP Metadata Builder</Title>
          </div>

          <Paper shadow="sm" p="xl" withBorder>
            <Stack gap="md">
              <div>
                <Text>
                  The{" "}
                  <Anchor
                    href={"http://carbontosea.org/oae-data-protocol/1-0-0/"}
                  >
                    Ocean Alkalinity Enhancement (OAE) Data Protocol
                  </Anchor>{" "}
                  outlines recommendations for producing consistent data and
                  metadata for Ocean Alkalinity Enhancement (OAE) research
                  projects.
                </Text>
              </div>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AppLayout>
  );
}
