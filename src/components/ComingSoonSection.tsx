"use client";
import { IconFileText, IconFlask, IconTemplate } from "@tabler/icons-react";
import { Box, Container, Flex, Title, Text, Paper, Stack } from "@mantine/core";

const items = [
	{ icon: <IconTemplate size={20} />, text: "Example project packages" },
	{ icon: <IconFlask size={20} />, text: "Academic field study examples" },
	{
		icon: <IconFileText size={20} />,
		text: "Supplier / operational trial examples",
	},
];

export default function ComingSoonSection() {
	return (
		<Box
			py="xl"
			style={{
				backgroundColor: "var(--brand-sand-overlay-medium)",
				borderTop: "1px solid var(--brand-sunlight-border)",
				borderBottom: "1px solid var(--brand-sunlight-border)",
				paddingTop: "4rem",
				paddingBottom: "4rem",
			}}
		>
			<Container size="md" px="md">
				<Flex direction={{ base: "column", md: "row" }} align="center" gap="xl">
					<Box style={{ flex: 1 }}>
						<Box
							mb="md"
							px="xs"
							py={4}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "0.5rem",
								borderRadius: "9999px",
								backgroundColor: "var(--brand-hadal-overlay)",
								color: "var(--brand-hadal)",
								fontSize: "0.75rem",
								fontWeight: 700,
								textTransform: "uppercase",
								letterSpacing: "0.05em",
							}}
						>
							<span
								style={{
									width: "8px",
									height: "8px",
									borderRadius: "50%",
									backgroundColor: "var(--brand-coral)",
								}}
							/>
							Coming Soon
						</Box>
						<Title order={2} mb="md" c="hadal.9">
							Metadata Examples
						</Title>
						<Text mb="lg" style={{ color: "var(--brand-abyssal)" }}>
							We are actively working on example templates to make getting
							started even easier. These will be available directly from this
							page once released.
						</Text>
					</Box>

					<Box style={{ flex: 1, width: "100%" }}>
						<Paper
							p="lg"
							radius="xl"
							withBorder
							style={{
								backgroundColor: "var(--brand-white)",
								borderColor: "var(--brand-sunlight-border-medium)",
								boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
							}}
						>
							<Title
								order={3}
								mb="md"
								c="hadal.9"
								style={{ fontSize: "1.125rem" }}
							>
								Planned Templates
							</Title>
							<Stack gap="sm">
								{items.map((item) => (
									<Box
										key={item.text}
										style={{
											display: "flex",
											alignItems: "center",
											gap: "0.75rem",
											color: "var(--brand-abyssal)",
											padding: "0.75rem",
											borderRadius: "0.5rem",
											backgroundColor: "var(--brand-shell-overlay)",
										}}
									>
										<Box style={{ color: "var(--brand-midnight)" }}>
											{item.icon}
										</Box>
										<Text size="sm" fw={500}>
											{item.text}
										</Text>
									</Box>
								))}
							</Stack>
						</Paper>
					</Box>
				</Flex>
			</Container>
		</Box>
	);
}
