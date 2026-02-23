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
            <Title order={1}>About the OAE Metadata Builder</Title>
          </div>
          <Paper shadow="sm" p="xl" withBorder>
            <Stack gap="md">
              <div>
                <Text>
                  The Ocean Alkalinity Enhancement (OAE) metadata builder is designed to increase the robustness and ease of implementing the{" "}
                  <Anchor href="https://www.carbontosea.org/oae-data-protocol/1-0-0/" target="_blank">OAE Data Management Protocol</Anchor>
                  , a community developed set of recommendations for producing consistent data and metadata for Ocean Alkalinity Enhancement (OAE) research projects in collaboration with the{" "}
                  <Anchor href="https://www.noaa.gov/" target="_blank">National Oceanic and Atmospheric Administration</Anchor>
                  {" "}(NOAA). The metadata builder was developed by{" "}
                  <Anchor href="https://www.submarine.earth" target="_blank">Submarine Scientific</Anchor>
                  {" "}with support from the{" "}
                  <Anchor href="https://www.carbontosea.org/" target="_blank">Carbon to Sea Initiative</Anchor>.
                  <br/>
                  <br/>
                  The metadata builder allows users to manage complex metadata for OAE projects, experiments, oceanographic datasets, and ocean models through a single web-based interface, and export standardized JSON metadata files that are fully compliant with the OAE Data Protocol. These metadata files are intended to be uploaded alongside datasets to any scientific data repository, and will be used by the OAE Data Commons to enhance search and discovery across the field of ocean alkalinity enhancement research.
                  <br/>
                  <br/>
                  The full open-source code for the metadata builder is available on{" "}
                  <Anchor href="https://github.com/submarine-mrv/oae-metadata-builder" target="_blank">Github</Anchor>
                  . For advanced technical users, the formal JSON Schema specification for the OAE Data Protocol is published{" "}
                  <Anchor href="https://github.com/submarine-mrv/oae-data-protocol/blob/main/project/jsonschema/oae_data_protocol.schema.json" target="_blank">here</Anchor>.
                  <br/>
                  <br/>
                  The metadata builder is the first of several tools under development to support researchers in managing protocol-compliant OAE metadata. Future plans include direct metadata management via software tooling such as Python libraries, as well as AI integration via MCP Servers.
                  <br/>
                  <br/>
                  If you have questions or concerns, please email{" "}
                  <Anchor href="mailto:data@carbontosea.org">data@carbontosea.org</Anchor>
                </Text>
              </div>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AppLayout>
  );
}
