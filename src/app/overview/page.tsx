"use client";
import React, { useEffect } from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  Group,
  Button,
  Badge,
  SimpleGrid
} from "@mantine/core";
import {
  IconPlus,
  IconFlask
} from "@tabler/icons-react";
import { useAppState } from "@/contexts/AppStateContext";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import { CompletionCard } from "@/components/CompletionCard";

export default function OverviewPage() {
  const {
    state,
    setActiveTab,
    addExperiment,
    setActiveExperiment,
    deleteExperiment,
    getProjectCompletionPercentage,
    getExperimentCompletionPercentage
  } = useAppState();
  const router = useRouter();

  useEffect(() => {
    setActiveTab("overview");
  }, [setActiveTab]);

  const projectCompletion = getProjectCompletionPercentage();

  const handleCreateExperiment = () => {
    // addExperiment will auto-generate "Experiment N" if no name provided
    const id = addExperiment();
    setActiveExperiment(id);
    setActiveTab("experiment");
    router.push("/experiment");
  };

  const handleEditProject = () => {
    setActiveTab("project");
    router.push("/project");
  };

  const handleEditExperiment = (id: number) => {
    setActiveExperiment(id);
    setActiveTab("experiment");
    router.push("/experiment");
  };

  const handleDeleteExperiment = (id: number, e: React.MouseEvent) => {
    if (confirm("Are you sure you want to delete this experiment?")) {
      deleteExperiment(id);
    }
  };

  return (
    <div>
      <Navigation />
      <Container size="lg" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <div>
            <Title order={1}>OAE Data Protocol – Overview</Title>
            <Text c="dimmed" mt="sm">
              Track your project and experiments at a glance
            </Text>
          </div>

          {/* Project Card */}
          <CompletionCard
            title="Project Metadata"
            subtitle={state.projectData?.project_id || "No project ID set"}
            progress={projectCompletion}
            onEdit={handleEditProject}
          />

          {/* Experiments Section */}
          <div>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={2}>Experiments</Title>
                <Text size="sm" c="dimmed">
                  {state.experiments.length} experiment
                  {state.experiments.length !== 1 ? "s" : ""} created
                </Text>
              </div>
              {state.experiments.length > 0 && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={handleCreateExperiment}
                >
                  New Experiment
                </Button>
              )}
            </Group>

            {state.experiments.length === 0 ? (
              <Card shadow="sm" padding="xl" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <IconFlask size={48} style={{ opacity: 0.3 }} />
                  <Text c="dimmed" ta="center">
                    No experiments yet. Create your first experiment to get
                    started.
                  </Text>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={handleCreateExperiment}
                  >
                    Create First Experiment
                  </Button>
                </Stack>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {state.experiments.map((experiment) => (
                  <CompletionCard
                    key={experiment.id}
                    title={experiment.name}
                    badge={
                      experiment.experiment_type && (
                        <Badge variant="light" color="blue">
                          {experiment.experiment_type}
                        </Badge>
                      )
                    }
                    progress={getExperimentCompletionPercentage(experiment.id)}
                    onEdit={() => handleEditExperiment(experiment.id)}
                    onDelete={(e) => handleDeleteExperiment(experiment.id, e)}
                    lastUpdated={experiment.updatedAt}
                    showDeleteButton={true}
                  />
                ))}
              </SimpleGrid>
            )}
          </div>
        </Stack>
      </Container>
    </div>
  );
}