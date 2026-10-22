import { Anchor, Container, Paper, Stack, Text, Title } from "@mantine/core";
import AppLayout from "@/components/AppLayout";

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export default function AboutPage() {
  return (
    <AppLayout>
      <Container size="md" py="xl">
        <Stack gap="lg">
          <Title order={1}>About the OAE Metadata Builder</Title>
          <Paper shadow="sm" p="xl" withBorder>
            <Stack gap={40}>
              <Stack gap="md">
                <Title order={2}>What it does</Title>
                <Text>
                  The OAE metadata builder manages metadata for Ocean Alkalinity Enhancement (OAE)
                  projects, experiments, oceanographic datasets, and ocean models in a single
                  web-based interface. It exports standardized JSON metadata files that are fully
                  compliant with the OAE Data Protocol. The files are meant to be uploaded alongside
                  datasets to any scientific data repository, or as part of a project submission to
                  the{" "}
                  <Anchor underline="always" href="https://oaedata.org" {...external}>
                    OAE Data Commons
                  </Anchor>
                  .
                </Text>
              </Stack>

              <Stack gap="md">
                <Title order={2}>How it works</Title>
                <Text>
                  The builder implements the{" "}
                  <Anchor
                    underline="always"
                    href="https://www.carbontosea.org/oae-data-protocol/1-0-0/"
                    {...external}
                  >
                    OAE Data Management Protocol
                  </Anchor>
                  , a community-developed set of recommendations for producing consistent data and
                  metadata for OAE research projects. The protocol was developed in collaboration
                  with the{" "}
                  <Anchor underline="always" href="https://www.noaa.gov/" {...external}>
                    National Oceanic and Atmospheric Administration
                  </Anchor>{" "}
                  (NOAA) and ocean researchers from academia, government, non-profit, and industry.
                  The OAE Data Commons uses the exported files to support search and discovery
                  across OAE research.
                </Text>
                <Text>
                  The full source code is on{" "}
                  <Anchor
                    underline="always"
                    href="https://github.com/submarine-mrv/oae-metadata-builder"
                    {...external}
                  >
                    GitHub
                  </Anchor>
                  . Technical documentation for the protocol schema, including the formal JSON
                  Schema, is at{" "}
                  <Anchor underline="always" href="https://schema.oaedata.org" {...external}>
                    schema.oaedata.org
                  </Anchor>
                  .
                </Text>
                <Text>
                  The builder is the first of several tools for managing protocol-compliant OAE
                  metadata. Planned next are Python libraries for programmatic metadata management,
                  plus agent skills and other agentic tooling for AI-assisted metadata work.
                </Text>
              </Stack>

              <Stack gap="md">
                <Title order={2}>Credits</Title>
                <Text>
                  Developed by{" "}
                  <Anchor underline="always" href="https://www.submarine.earth" {...external}>
                    Submarine Scientific
                  </Anchor>{" "}
                  with support from the{" "}
                  <Anchor underline="always" href="https://www.carbontosea.org/" {...external}>
                    Carbon to Sea Initiative
                  </Anchor>
                  . If you have questions, please email{" "}
                  <Anchor underline="always" href="mailto:data@carbontosea.org">
                    data@carbontosea.org
                  </Anchor>
                  .
                </Text>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AppLayout>
  );
}
