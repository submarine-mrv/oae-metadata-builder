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
  Progress,
  Badge,
  SimpleGrid
} from "@mantine/core";
import {
  IconPlus,
  IconFolder,
  IconFlask,
  IconDatabase,
  IconEdit,
  IconTrash
} from "@tabler/icons-react";
import { useAppState } from "@/contexts/AppStateContext";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";

export default function OverviewPage() {
  const {
    state,
    setActiveTab,
    addExperiment,
    setActiveExperiment,
    deleteExperiment,
    getProjectCompletionPercentage,
    getExperimentCompletionPercentage,
    addDataset,
    setActiveDataset,
    deleteDataset
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
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this experiment?")) {
      deleteExperiment(id);
    }
  };

  const handleCreateDataset = () => {
    const id = addDataset();
    setActiveDataset(id);
    setActiveTab("dataset");
    router.push("/dataset");
  };

  const handleEditDataset = (id: number) => {
    setActiveDataset(id);
    setActiveTab("dataset");
    router.push("/dataset");
  };

  const handleDeleteDataset = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this dataset?")) {
      deleteDataset(id);
    }
  };

  // Helper to find linked experiment for a dataset
  const getLinkedExperiment = (dataset: (typeof state.datasets)[0]) => {
    // First check linking metadata
    if (dataset.linking?.linkedExperimentInternalId) {
      return state.experiments.find(
        (e) => e.id === dataset.linking?.linkedExperimentInternalId
      );
    }
    // Fallback: match by experiment_id string
    const expId = dataset.formData.experiment_id;
    if (expId) {
      return state.experiments.find((e) => e.formData.experiment_id === expId);
    }
    return null;
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage === 0) return "gray";
    if (percentage < 33) return "progressOrange.4";
    if (percentage < 100) return "progressBlue.4";
    return "progressGreen.4";
  };

  const getCompletionLabel = (percentage: number) => {
    if (percentage === 0) return "Not Started";
    if (percentage < 100) return "In Progress";
    return "Complete";
  };

  return (
    <AppLayout>
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
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Group>
                <IconFolder size={24} />
                <div>
                  <Text fw={600} size="lg">
                    Project Metadata
                  </Text>
                  <Text size="sm" c="dimmed">
                    {state.projectData?.project_id || "No project ID set"}
                  </Text>
                </div>
              </Group>
              <Button
                leftSection={<IconEdit size={16} />}
                onClick={handleEditProject}
              >
                Edit Project
              </Button>
            </Group>

            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm">Completion</Text>
                <Badge color={getCompletionColor(projectCompletion)}>
                  {getCompletionLabel(projectCompletion)}
                </Badge>
              </Group>
              <Progress
                value={projectCompletion}
                size="xl"
                radius="md"
                color={getCompletionColor(projectCompletion)}
              />
              <Text size="xs" c="dimmed" ta="right">
                {projectCompletion}% complete
              </Text>
            </Stack>
          </Card>

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
                {state.experiments.map((experiment) => {
                  const completion = getExperimentCompletionPercentage(
                    experiment.id
                  );
                  return (
                    <Card
                      key={experiment.id}
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{ cursor: "pointer" }}
                      onClick={() => handleEditExperiment(experiment.id)}
                    >
                      <Stack gap="sm">
                        <Group
                          justify="space-between"
                          wrap="nowrap"
                          align="flex-start"
                        >
                          <Group
                            gap="xs"
                            wrap="nowrap"
                            align="flex-start"
                            style={{ minWidth: 0 }}
                          >
                            <IconFlask
                              size={20}
                              style={{ flexShrink: 0, marginTop: 2 }}
                            />
                            <Text
                              fw={600}
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word"
                              }}
                            >
                              {experiment.name}
                            </Text>
                          </Group>
                          <Button
                            variant="subtle"
                            color="red"
                            size="xs"
                            style={{ flexShrink: 0 }}
                            onClick={(e) =>
                              handleDeleteExperiment(experiment.id, e)
                            }
                          >
                            <IconTrash size={16} />
                          </Button>
                        </Group>

                        {experiment.experiment_type && (
                          <Badge variant="light" size="sm">
                            {experiment.experiment_type === "intervention"
                              ? "Intervention"
                              : experiment.experiment_type}
                          </Badge>
                        )}

                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text size="xs">Progress</Text>
                            <Badge
                              size="xs"
                              color={getCompletionColor(completion)}
                            >
                              {completion}%
                            </Badge>
                          </Group>
                          <Progress
                            value={completion}
                            size="md"
                            radius="md"
                            color={getCompletionColor(completion)}
                          />
                        </Stack>

                        <Text size="xs" c="dimmed">
                          Last updated:{" "}
                          {new Date(experiment.updatedAt).toLocaleString()}
                        </Text>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            )}
          </div>

          {/* Datasets Section */}
          <div>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={2}>Datasets</Title>
                <Text size="sm" c="dimmed">
                  {state.datasets.length} dataset
                  {state.datasets.length !== 1 ? "s" : ""} created
                </Text>
              </div>
              {state.datasets.length > 0 && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={handleCreateDataset}
                >
                  New Dataset
                </Button>
              )}
            </Group>

            {state.datasets.length === 0 ? (
              <Card shadow="sm" padding="xl" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <IconDatabase size={48} style={{ opacity: 0.3 }} />
                  <Text c="dimmed" ta="center">
                    No datasets yet. Create your first dataset to define
                    variable metadata.
                  </Text>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={handleCreateDataset}
                  >
                    Create First Dataset
                  </Button>
                </Stack>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {state.datasets.map((dataset) => {
                  const variableCount =
                    (dataset.formData.variables?.length as number) || 0;
                  const linkedExperiment = getLinkedExperiment(dataset);
                  return (
                    <Card
                      key={dataset.id}
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{ cursor: "pointer" }}
                      onClick={() => handleEditDataset(dataset.id)}
                    >
                      <Stack gap="sm">
                        <Group
                          justify="space-between"
                          wrap="nowrap"
                          align="flex-start"
                        >
                          <Group
                            gap="xs"
                            wrap="nowrap"
                            align="flex-start"
                            style={{ minWidth: 0 }}
                          >
                            <IconDatabase
                              size={20}
                              style={{ flexShrink: 0, marginTop: 2 }}
                            />
                            <Text
                              fw={600}
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word"
                              }}
                            >
                              {dataset.name}
                            </Text>
                          </Group>
                          <Button
                            variant="subtle"
                            color="red"
                            size="xs"
                            style={{ flexShrink: 0 }}
                            onClick={(e) => handleDeleteDataset(dataset.id, e)}
                          >
                            <IconTrash size={16} />
                          </Button>
                        </Group>
                        {linkedExperiment && (
                          <Group gap="xs" wrap="nowrap" align="flex-start">
                            <IconFlask
                              size={14}
                              color="gray"
                              style={{ flexShrink: 0, marginTop: 1 }}
                            />
                            <Text
                              size="xs"
                              c="dimmed"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word"
                              }}
                            >
                              {linkedExperiment.name}
                            </Text>
                          </Group>
                        )}
                        {dataset.formData.dataset_type && (
                          <Badge variant="light" size="sm">
                            {dataset.formData.dataset_type}
                          </Badge>
                        )}
                        <Text size="sm" c="dimmed">
                          {variableCount} variable
                          {variableCount !== 1 ? "s" : ""} defined
                        </Text>

                        <Text size="xs" c="dimmed">
                          Last updated:{" "}
                          {new Date(dataset.updatedAt).toLocaleString()}
                        </Text>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            )}
          </div>
        </Stack>
      </Container>
    </AppLayout>
  );
}
