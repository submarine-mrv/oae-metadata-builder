"use client";
import type { ReactNode } from "react";
import { Paper, Box, Title, Text, Flex } from "@mantine/core";

interface StepCardProps {
	stepNumber: string;
	title: string;
	description: string;
	children?: ReactNode;
}

export default function StepCard({
	stepNumber,
	title,
	description,
	children,
}: StepCardProps) {
	return (
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
			<Flex direction={{ base: "column", md: "row" }} gap="lg">
				<Box style={{ flexShrink: 0 }}>
					<Box
						style={{
							width: "48px",
							height: "48px",
							borderRadius: "9999px",
							backgroundColor: "var(--brand-coral-overlay)",
							border: "1px solid var(--brand-coral-overlay-border)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Text
							ff="var(--font-display)"
							fw={700}
							style={{ fontSize: "1.25rem", color: "var(--brand-coral)" }}
						>
							{stepNumber}
						</Text>
					</Box>
				</Box>

				<Box style={{ flex: 1 }}>
					<Box mb="md">
						<Title order={3} mb="xs" c="hadal.9">
							{title}
						</Title>
						<Text style={{ color: "var(--brand-abyssal)", lineHeight: 1.625 }}>
							{description}
						</Text>
					</Box>

					{children && (
						<Box
							pt={8}
							style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
						>
							{children}
						</Box>
					)}
				</Box>
			</Flex>
		</Paper>
	);
}
