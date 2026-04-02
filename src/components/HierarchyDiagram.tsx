"use client";
import { Box, Flex, Text } from "@mantine/core";

export default function HierarchyDiagram() {
	return (
		<Box w="100%" maw="48rem" mx="auto" py="lg">
			<Flex direction="column" align="center" pos="relative">
				{/* Level 1: Project */}
				<Box style={{ zIndex: 10 }}>
					<Box
						px="lg"
						py="xs"
						style={{
							backgroundColor: "var(--brand-hadal)",
							color: "var(--brand-white)",
							borderRadius: "0.5rem",
							boxShadow:
								"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
							borderBottom: "4px solid var(--brand-hadal)",
							width: "14rem",
							textAlign: "center",
						}}
					>
						<Text
							ff="var(--font-display)"
							fw={700}
							style={{ fontSize: "1.125rem", display: "block" }}
						>
							Project
						</Text>
						<Text
							size="xs"
							style={{
								color: "var(--brand-twilight)",
								letterSpacing: "0.025em",
							}}
						>
							My First OAE Project
						</Text>
					</Box>
				</Box>

				{/* Connector Line 1 */}
				<Box
					style={{
						width: "2px",
						height: "40px",
						backgroundColor: "var(--brand-twilight)",
					}}
				/>

				{/* Horizontal Branch Line */}
				<Box
					style={{
						height: "2px",
						backgroundColor: "var(--brand-twilight)",
						width: "60%",
					}}
				/>

				{/* Vertical Connectors to Level 2 */}
				<Box
					style={{
						display: "flex",
						justifyContent: "space-between",
						width: "60%",
						height: "2rem",
					}}
				>
					<Box
						style={{
							width: "2px",
							height: "100%",
							backgroundColor: "var(--brand-twilight)",
						}}
					/>
					<Box
						style={{
							width: "2px",
							height: "100%",
							backgroundColor: "var(--brand-twilight)",
						}}
					/>
				</Box>

				{/* Level 2: Experiments */}
				<Flex justify="space-between" w={{ base: "100%", md: "80%" }} gap="md">
					{/* Experiment A */}
					<Flex direction="column" align="center" style={{ flex: 1 }}>
						<Box
							style={{
								backgroundColor: "var(--brand-white)",
								border: "2px solid var(--brand-midnight-overlay)",
								borderBottom: "4px solid var(--brand-midnight)",
								padding: "0.75rem 1rem",
								borderRadius: "0.5rem",
								boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
								width: "100%",
								maxWidth: "200px",
								textAlign: "center",
								marginBottom: "1rem",
								position: "relative",
								zIndex: 10,
							}}
						>
							<Text
								ff="var(--font-display)"
								fw={600}
								style={{ color: "var(--brand-hadal)", display: "block" }}
							>
								Experiment A
							</Text>
							<Text size="xs" style={{ color: "var(--brand-midnight)" }}>
								Baseline
							</Text>
						</Box>

						<Box
							style={{
								width: "2px",
								height: "24px",
								backgroundColor: "var(--brand-twilight)",
								marginBottom: "1rem",
							}}
						/>

						<Box
							style={{
								width: "100%",
								maxWidth: "180px",
								display: "flex",
								flexDirection: "column",
								gap: "0.5rem",
							}}
						>
							{["Dataset 1", "Dataset 2"].map((label) => (
								<Box
									key={label}
									style={{
										backgroundColor: "var(--brand-white)",
										padding: "0.5rem 0.75rem",
										borderRadius: "0.25rem",
										border: "1px solid var(--brand-coral-overlay-medium)",
										borderBottom: "3px solid var(--brand-coral)",
										textAlign: "center",
									}}
								>
									<Text size="sm" style={{ color: "var(--brand-abyssal)" }}>
										{label}
									</Text>
								</Box>
							))}
						</Box>
					</Flex>

					{/* Experiment B */}
					<Flex direction="column" align="center" style={{ flex: 1 }}>
						<Box
							style={{
								backgroundColor: "var(--brand-white)",
								border: "2px solid var(--brand-midnight-overlay)",
								borderBottom: "4px solid var(--brand-midnight)",
								padding: "0.75rem 1rem",
								borderRadius: "0.5rem",
								boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
								width: "100%",
								maxWidth: "200px",
								textAlign: "center",
								marginBottom: "1rem",
								position: "relative",
								zIndex: 10,
							}}
						>
							<Text
								ff="var(--font-display)"
								fw={600}
								style={{ color: "var(--brand-hadal)", display: "block" }}
							>
								Experiment B
							</Text>
							<Text size="xs" style={{ color: "var(--brand-midnight)" }}>
								Intervention 01
							</Text>
						</Box>

						<Box
							style={{
								width: "2px",
								height: "24px",
								backgroundColor: "var(--brand-twilight)",
								marginBottom: "1rem",
							}}
						/>

						<Box
							style={{
								width: "100%",
								maxWidth: "180px",
								display: "flex",
								flexDirection: "column",
								gap: "0.5rem",
							}}
						>
							<Box
								style={{
									backgroundColor: "var(--brand-white)",
									padding: "0.5rem 0.75rem",
									borderRadius: "0.25rem",
									border: "1px solid var(--brand-coral-overlay-medium)",
									borderBottom: "3px solid var(--brand-coral)",
									textAlign: "center",
								}}
							>
								<Text size="sm" style={{ color: "var(--brand-abyssal)" }}>
									Dataset 3
								</Text>
							</Box>
						</Box>
					</Flex>
				</Flex>
			</Flex>
		</Box>
	);
}
