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
                    The Ocean Alkalinity Enhancement (OAE) metadata builder is designed to increase the robustness and ease of implementing the [OAE Data Management Protocol](https://www.carbontosea.org/oae-data-protocol/1-0-0/), a community developed set of recommendations for producing consistent data and metadata for Ocean Alkalinity Enhancement (OAE) research projects in collaboration with the [National Oceanic and Atmospheric Administration](https://www.noaa.gov/) (NOAA). The metadata builder was developed by [Submarine Scientific](http://www.submarine.earth) with support from the [Carbon to Sea Initiative](https://www.carbontosea.org/).
                    <br/>
                    <br/>
                    The metadata builder allows users to manage complex metadata for OAE projects, experiments, oceanographic datasets, and ocean models through a single web-based interface, and export standardized JSON metadata files that are fully compliant with the OAE Data Protocol. These metadata files are intended to be uploaded alongside datasets to any scientific data repository, and will be used by the OAE Data Commons to enhance search and discovery across the field of ocean alkalinity enhancement research.
                    <br/>
                    <br/>
                    The full open-source code for the metadata builder is available on [Github](https://github.com/submarine-mrv/oae-metadata-builder). For advanced technical users, the formal JSON Schema specification for the OAE Data Protocol is published [here](https://github.com/submarine-mrv/oae-data-protocol/blob/main/project/jsonschema/oae_data_protocol.schema.json).
                    <br/>
                    <br/>
                    The metadata builder is the first of several tools under development to support researchers in managing protocol-compliant OAE metadata. Future plans include direct metadata management via software tooling such as Python libraries, as well as AI integration via MCP Servers.
                    <br/>
                    <br/>
                    If you have questions or concerns, please email [data@carbontosea.org](mailto:data@carbontosea.org)
                </Text>
              </div>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AppLayout>
  );
}
