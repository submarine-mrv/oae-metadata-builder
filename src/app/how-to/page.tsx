"use client";
import { IconUser, IconShare, IconArrowRight } from "@tabler/icons-react";
import {
	Box,
	Container,
	Title,
	Text,
	Flex,
	SimpleGrid,
	Group,
	Paper,
	Badge,
} from "@mantine/core";
import AppLayout from "@/components/AppLayout";
import CalloutBox from "@/components/CalloutBox";
import StepCard from "@/components/StepCard";
import WorkflowCard from "@/components/WorkflowCard";
import HierarchyDiagram from "@/components/HierarchyDiagram";
import ComingSoonSection from "@/components/ComingSoonSection";

export default function HowToPage() {
	return (
		<AppLayout>
			{/* 1. Hero Section */}
			<Box component="header" pt={64} pb={48} px="md">
				<Container size="md" style={{ textAlign: "center" }}>
					<Title
						order={1}
						mb="md"
						c="hadal.9"
						style={{
							fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
							lineHeight: 1.1,
						}}
					>
						How to Use the Metadata Builder
					</Title>
					<Text
						size="xl"
						mx="auto"
						maw="42rem"
						c="abyssal.6"
						style={{ lineHeight: 1.625 }}
					>
						A guide to creating complete, valid metadata packages.
					</Text>
					<Box mt="xl" style={{ display: "flex", justifyContent: "center" }}>
						<Box
							style={{
								height: "4px",
								width: "6rem",
								backgroundColor: "var(--brand-coral)",
								borderRadius: "9999px",
								opacity: 0.8,
							}}
						/>
					</Box>
				</Container>
			</Box>

			{/* 2. The Big Picture */}
			<Box
				component="section"
				py={64}
				style={{
					backgroundColor: "var(--brand-shell)",
					borderTop: "1px solid var(--brand-sunlight-border)",
					borderBottom: "1px solid var(--brand-sunlight-border)",
				}}
			>
				<Container size="md" px="md">
					<Box mb={48} style={{ textAlign: "center" }}>
						<Title
							order={2}
							mb="md"
							c="hadal.9"
							style={{
								fontSize: "clamp(1.875rem, 4vw, 2.25rem)",
							}}
						>
							The Big Picture: Organization
						</Title>
						<Text mx="auto" maw="42rem" c="abyssal.6">
							The Metadata Builder uses a three-level hierarchy to organize your
							scientific data. Think of it like a tree structure.
						</Text>
					</Box>

					<HierarchyDiagram />

					<Box mt="xl" mb={48} style={{ textAlign: "center" }}>
						<Text size="sm" c="midnight.4" style={{ fontStyle: "italic" }}>
							Each level captures different information, forming a single
							complete record.
						</Text>
					</Box>

					{/* Level Descriptions */}
					<Flex direction="column" gap="xl">
						{/* Project Level */}
						<Paper
							p={{ base: "lg", md: "xl" }}
							radius="lg"
							withBorder
							style={{
								backgroundColor: "var(--brand-white)",
								borderColor: "var(--brand-sunlight-border-medium)",
								boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
							}}
						>
							<Badge
								variant="filled"
								mb="md"
								style={{
									backgroundColor: "var(--brand-hadal)",
									color: "var(--brand-white)",
									fontWeight: 600,
									letterSpacing: "0.025em",
								}}
							>
								Project
							</Badge>
							<Box mb="md">
								<Title order={3} mb="xs" c="hadal.9">
									Project Metadata
								</Title>
								<Text c="abyssal.6" style={{ lineHeight: 1.625 }}>
									Describes the overall effort and only needs to be completed
									once per project. Includes project name, participating
									organizations, objectives, geographic region, and governance
									information. Think of this as the context that all experiments
									and datasets belong to.
								</Text>
							</Box>
							<Box
								pt={8}
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "1rem",
								}}
							>
								<CalloutBox variant="who" title="Who typically fills this out?">
									A lead organization or designated data manager.
								</CalloutBox>
							</Box>
						</Paper>

						{/* Experiment Level */}
						<Paper
							p={{ base: "lg", md: "xl" }}
							radius="lg"
							withBorder
							style={{
								backgroundColor: "var(--brand-white)",
								borderColor: "var(--brand-sunlight-border-medium)",
								boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
							}}
						>
							<Badge
								variant="filled"
								mb="md"
								style={{
									backgroundColor: "var(--brand-midnight)",
									color: "var(--brand-white)",
									fontWeight: 600,
									letterSpacing: "0.025em",
								}}
							>
								Experiment
							</Badge>
							<Box mb="md">
								<Title order={3} mb="xs" c="hadal.9">
									Experiment Metadata
								</Title>
								<Text c="abyssal.6" style={{ lineHeight: 1.625 }}>
									Represents a coherent operational or scientific unit within
									the project, such as a field deployment, monitoring phase, or
									seasonal trial.
								</Text>
							</Box>
							<Box
								pt={8}
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "1rem",
								}}
							>
								<CalloutBox variant="tip" title="For Suppliers">
									It may be helpful to think of an experiment as roughly
									equivalent to a crediting cycle or a defined operational
									phase.
								</CalloutBox>
								<CalloutBox variant="who" title="Who typically fills this out?">
									Often the same person who manages the project metadata,
									especially when consistency across experiments matters.
								</CalloutBox>
							</Box>
						</Paper>

						{/* Dataset Level */}
						<Paper
							p={{ base: "lg", md: "xl" }}
							radius="lg"
							withBorder
							style={{
								backgroundColor: "var(--brand-white)",
								borderColor: "var(--brand-sunlight-border-medium)",
								boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
							}}
						>
							<Badge
								variant="filled"
								mb="md"
								style={{
									backgroundColor: "var(--brand-coral)",
									color: "var(--brand-white)",
									fontWeight: 600,
									letterSpacing: "0.025em",
								}}
							>
								Dataset
							</Badge>
							<Box mb="md">
								<Title order={3} mb="xs" c="hadal.9">
									Dataset Metadata
								</Title>
								<Text c="abyssal.6" style={{ lineHeight: 1.625 }}>
									Captures detailed information about specific data files,
									including generation methods, instruments, resolution,
									formats, and variable-level details. This is usually the most
									detailed part of the metadata.
								</Text>
							</Box>
							<Box
								pt={8}
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "1rem",
								}}
							>
								<CalloutBox variant="who" title="Who typically fills this out?">
									The person or organization that generated the data.
								</CalloutBox>
							</Box>
						</Paper>
					</Flex>
				</Container>
			</Box>

			{/* 3. Step-by-Step Guide */}
			<Box
				component="section"
				py={80}
				style={{ backgroundColor: "var(--brand-white)" }}
			>
				<Container size="md" px="md">
					<Box mb={48}>
						<Title
							order={2}
							mb="md"
							c="hadal.9"
							style={{
								fontSize: "clamp(1.875rem, 4vw, 2.25rem)",
							}}
						>
							Step-by-Step Guide
						</Title>
						<Text c="abyssal.6">
							How to create, save, and manage your metadata using the builder.
						</Text>
					</Box>

					<Flex direction="column" gap="xl">
						<StepCard
							stepNumber="1"
							title="Create Your Sections"
							description="Open the Metadata Builder and create the sections you need: Project, Experiment, or Dataset. You can add multiple experiments and datasets within a single session."
						>
							<CalloutBox variant="tip" title="Flexible Order">
								You don&apos;t need to work in any particular order. For
								example, you might create only a dataset, or only an experiment,
								or any combination — whatever your role requires.
							</CalloutBox>
						</StepCard>

						<StepCard
							stepNumber="2"
							title="Fill Out the Fields"
							description="Complete the metadata fields for each section you've created. The builder provides real-time validation and guidance to help you fill out each field correctly."
						/>

						<StepCard
							stepNumber="3"
							title="Export to Save Your Progress"
							description="Click the Export button in the navigation bar to download your metadata as a JSON file. This is how you save your work."
						>
							<CalloutBox variant="important" title="No Auto-Save">
								The builder does not have auto-save or user accounts. You must
								click Export to save your progress. Export frequently to avoid
								losing work.
							</CalloutBox>
						</StepCard>

						<StepCard
							stepNumber="4"
							title="Import to Continue Later"
							description="To resume work, click the Import button and upload your previously exported JSON file. You can select which metadata sections to import, making it easy to work with files from different contributors."
						>
							<CalloutBox variant="tip" title="Collaboration Tip">
								In most projects, multiple people contribute different parts of
								the metadata. Each person can export their sections
								independently, and a coordinator can import and combine them.
							</CalloutBox>
						</StepCard>
					</Flex>

					<Box mt="xl">
						<CalloutBox
							variant="important"
							title="Do Not Edit JSON Files Directly"
						>
							The Metadata Builder includes automated validation tests that run
							when metadata is created or modified. Editing the JSON file
							directly in a text editor bypasses these checks and may introduce
							errors. Always import your JSON file back into the builder, make
							your changes there, and export a revised version.
						</CalloutBox>
					</Box>
				</Container>
			</Box>

			{/* 4. Common Workflows */}
			<Box
				component="section"
				py={80}
				style={{
					backgroundColor: "var(--brand-sand-overlay)",
					borderTop: "1px solid var(--brand-sunlight-border)",
				}}
			>
				<Container size="md" px="md">
					<Title
						order={2}
						mb={40}
						c="hadal.9"
						style={{
							textAlign: "center",
							fontSize: "clamp(1.875rem, 4vw, 2.25rem)",
						}}
					>
						Common Workflows
					</Title>

					<SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
						<WorkflowCard
							title="One Data Manager"
							icon={<IconUser size={24} color="var(--brand-hadal)" />}
							description="In smaller projects, one data manager fills out everything: Project, Experiment, and Dataset metadata."
							benefits={[
								"Fastest path for small teams",
								"Low coordination costs",
								"Centralized control",
							]}
						/>

						<WorkflowCard
							title="Distributed Contributions"
							icon={<IconShare size={24} color="var(--brand-hadal)" />}
							description="Designate a lead manager for Project/Experiment levels, while individual providers complete Dataset metadata."
							isRecommended
							benefits={[
								"Reduces duplication",
								"Improves consistency",
								"Keeps expertise close to data",
							]}
						/>
					</SimpleGrid>
				</Container>
			</Box>

			{/* 5. Submission Requirements */}
			<Box
				component="section"
				py={64}
				style={{ backgroundColor: "var(--brand-white)" }}
			>
				<Container size="sm" px="md">
					<CalloutBox
						variant="important"
						title="Important: Submitting to a Repository"
					>
						<Text
							component="span"
							style={{ display: "block", marginBottom: "1rem" }}
						>
							When you submit a dataset to a repository, dataset metadata alone
							is not sufficient.
						</Text>
						<Text
							component="span"
							style={{ display: "block", marginBottom: "1rem" }}
						>
							Each submission must include the JSON metadata files for the
							associated dataset, experiment, and project. This ensures future
							users can understand the full context and correctly interpret
							methods.
						</Text>
						<Group gap={8} c="hadal.9" style={{ fontWeight: 500 }}>
							<IconArrowRight size={16} />
							<Text>
								The Metadata Builder packages all of this together when you
								export.
							</Text>
						</Group>
					</CalloutBox>
				</Container>
			</Box>

			{/* 6. Coming Soon */}
			<ComingSoonSection />

			{/* 7. Need Help */}
			<Box
				component="footer"
				py={64}
				style={{ backgroundColor: "var(--brand-white)", textAlign: "center" }}
			>
				<Container size="sm" px="md">
					<Title order={2} mb="md" c="hadal.9">
						Need Help or Feedback?
					</Title>
					<Text mb="md" c="abyssal.6">
						If you&apos;re unsure how to structure your metadata or want
						feedback on your approach, we encourage you to reach out early. Your
						input helps shape how the builder evolves.
					</Text>
					<Text c="hadal.9" style={{ fontWeight: 500 }}>
						Reach out:{" "}
						<Text
							component="a"
							href="mailto:data@carbontosea.org"
							style={{ color: "var(--viz-ocean)", textDecoration: "underline" }}
						>
							data@carbontosea.org
						</Text>
					</Text>
				</Container>
			</Box>
		</AppLayout>
	);
}
