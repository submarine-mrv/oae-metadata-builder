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
  IconTrash
} from "@tabler/icons-react";
import { useAppState } from "@/contexts/AppStateContext";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";

export default function OverviewPage() {
  const {
    state,
    setActiveTab,
    createProject,
    deleteProject,
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

  const handleCreateProject = () => {
    createProject();
    setActiveTab("project");
    router.push("/project");
  };

  const handleDeleteProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(
        "Are you sure you want to delete this project? This will clear project data and unlink project IDs from experiments and datasets."
      )
    ) {
      deleteProject();
    }
  };

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

  // Build list of uncreated entity types for compact card row
  const uncreatedEntities: Array<{
    key: string;
    icon: React.FC<{ size: number; style?: React.CSSProperties }>;
    label: string;
    onClick: () => void;
  }> = [];
  if (!state.hasProject)
    uncreatedEntities.push({
      key: "project",
      icon: IconFolder,
      label: "Project",
      onClick: handleCreateProject
    });
  if (state.experiments.length === 0)
    uncreatedEntities.push({
      key: "experiment",
      icon: IconFlask,
      label: "Experiment",
      onClick: handleCreateExperiment
    });
  if (state.datasets.length === 0)
    uncreatedEntities.push({
      key: "dataset",
      icon: IconDatabase,
      label: "Dataset",
      onClick: handleCreateDataset
    });

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

          {/* Project Section — only when created */}
          {state.hasProject && (
            <div>
              <Group justify="space-between" mb="md">
                <Title order={2}>Project</Title>
              </Group>

              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: "pointer" }}
                onClick={handleEditProject}
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
                      <IconFolder
                        size={20}
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600}>Project Metadata</Text>
                        <Text
                          size="sm"
                          c="dimmed"
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {state.projectData?.project_id || "No project ID set"}
                        </Text>
                      </div>
                    </Group>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      style={{ flexShrink: 0 }}
                      onClick={handleDeleteProject}
                    >
                      <IconTrash size={16} />
                    </Button>
                  </Group>

                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="xs">Progress</Text>
                      <Badge
                        size="xs"
                        color={getCompletionColor(projectCompletion)}
                      >
                        {projectCompletion}%
                      </Badge>
                    </Group>
                    <Progress
                      value={projectCompletion}
                      size="md"
                      radius="md"
                      color={getCompletionColor(projectCompletion)}
                    />
                  </Stack>
                </Stack>
              </Card>
            </div>
          )}

          {/* Experiments Section — only when experiments exist */}
          {state.experiments.length > 0 && (
            <div>
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={2}>Experiments</Title>
                  <Text size="sm" c="dimmed">
                    {state.experiments.length} experiment
                    {state.experiments.length !== 1 ? "s" : ""} created
                  </Text>
                </div>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={handleCreateExperiment}
                >
                  New Experiment
                </Button>
              </Group>

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
                            {experiment.experiment_type
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
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
            </div>
          )}

          {/* Datasets Section — only when datasets exist */}
          {state.datasets.length > 0 && (
            <div>
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={2}>Datasets</Title>
                  <Text size="sm" c="dimmed">
                    {state.datasets.length} dataset
                    {state.datasets.length !== 1 ? "s" : ""} created
                  </Text>
                </div>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={handleCreateDataset}
                >
                  New Dataset
                </Button>
              </Group>

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
            </div>
          )}

          {/* Compact create cards for uncreated entities */}
          {uncreatedEntities.length > 0 && (
            <SimpleGrid
              cols={
                uncreatedEntities.length === 1
                  ? { base: 1 }
                  : uncreatedEntities.length === 2
                    ? { base: 1, xs: 2 }
                    : { base: 1, xs: 2, sm: 3 }
              }
              spacing="md"
              {...(uncreatedEntities.length === 1 ? { maw: 300 } : {})}
            >
              {uncreatedEntities.map((entity) => (
                <Card
                  key={entity.key}
                  shadow="none"
                  padding="lg"
                  radius="md"
                  withBorder
                  style={{
                    cursor: "pointer",
                    borderStyle: "dashed",
                    borderWidth: 2,
                    borderColor: "var(--mantine-color-gray-4)",
                    backgroundColor: "transparent",
                    transition: "border-color 150ms, box-shadow 150ms"
                  }}
                  onClick={entity.onClick}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--mantine-color-gray-6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderStyle = "dashed";
                    e.currentTarget.style.borderColor =
                      "var(--mantine-color-gray-4)";
                  }}
                >
                  <Stack align="center" gap="xs">
                    <entity.icon size={28} style={{ opacity: 0.4 }} />
                    <Text size="sm" fw={500}>
                      {entity.label}
                    </Text>
                    <Group gap={4}>
                      <IconPlus size={14} />
                      <Text size="xs">Create</Text>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Container>
    </AppLayout>
  );
}
