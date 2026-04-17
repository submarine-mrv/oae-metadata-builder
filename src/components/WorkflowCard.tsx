"use client";
import { IconCheck } from "@tabler/icons-react";
import { Paper, Box, Title, Text, Badge, List } from "@mantine/core";
import type { ReactNode } from "react";

interface WorkflowCardProps {
	title: string;
	icon: ReactNode;
	description: string;
	benefits: string[];
	isRecommended?: boolean;
}

export default function WorkflowCard({
	title,
	icon,
	description,
	benefits,
	isRecommended = false,
}: WorkflowCardProps) {
	return (
		<Paper
			p="lg"
			radius="lg"
			withBorder
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				position: "relative",
				backgroundColor: "var(--brand-white)",
				borderColor: isRecommended
					? "var(--brand-coral-overlay-medium)"
					: "var(--brand-sunlight)",
				boxShadow: isRecommended
					? "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px var(--brand-coral-overlay)"
					: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
			}}
		>
			{isRecommended && (
				<Box style={{ position: "absolute", top: "-12px", left: "24px" }}>
					<Badge
						variant="filled"
						size="lg"
						radius="xl"
						style={{
							backgroundColor: "var(--brand-coral)",
							color: "var(--brand-white)",
							fontWeight: 700,
							textTransform: "uppercase",
							letterSpacing: "0.025em",
							boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
						}}
					>
						Recommended
					</Badge>
				</Box>
			)}

			<Box
				mb="md"
				p="xs"
				style={{
					backgroundColor: "var(--brand-shell)",
					borderRadius: "0.5rem",
					width: "fit-content",
					color: "var(--brand-hadal)",
				}}
			>
				{icon}
			</Box>

			<Title
				order={3}
				mb="xs"
				fw={700}
				c="hadal.9"
				style={{ fontSize: "1.25rem" }}
			>
				{title}
			</Title>

			<Text
				size="sm"
				mb="lg"
				style={{ color: "var(--brand-abyssal)", flexGrow: 1 }}
			>
				{description}
			</Text>

			<Box
				pt="md"
				mt="auto"
				style={{ borderTop: "1px solid var(--brand-shell)" }}
			>
				<Text
					size="xs"
					fw={600}
					mb="xs"
					style={{
						color: "var(--brand-midnight)",
						textTransform: "uppercase",
						letterSpacing: "0.05em",
					}}
				>
					Benefits
				</Text>

				<List
					spacing="xs"
					size="sm"
					center={false}
					icon={
						<IconCheck
							size={16}
							color="var(--brand-coral)"
							style={{ marginTop: 2 }}
						/>
					}
				>
					{benefits.map((benefit) => (
						<List.Item key={benefit} style={{ color: "var(--brand-abyssal)" }}>
							{benefit}
						</List.Item>
					))}
				</List>
			</Box>
		</Paper>
	);
}
