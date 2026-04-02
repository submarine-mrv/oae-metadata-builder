"use client";
import {
	IconUser,
	IconAlertCircle,
	IconBulb,
	IconInfoCircle,
} from "@tabler/icons-react";
import { Box, Group, Text } from "@mantine/core";

type CalloutVariant = "who" | "important" | "tip";

interface CalloutBoxProps {
	variant: CalloutVariant;
	title?: string;
	children: React.ReactNode;
	className?: string;
}

const variantConfig = {
	who: {
		bg: "var(--brand-shell)",
		borderColor: "var(--brand-midnight)",
		icon: <IconUser size={20} color="var(--brand-midnight)" />,
		titleColor: "var(--brand-hadal)",
		textColor: "var(--brand-abyssal)",
	},
	important: {
		bg: "var(--brand-coral-overlay-light)",
		borderColor: "var(--brand-coral)",
		icon: <IconAlertCircle size={20} color="var(--brand-coral)" />,
		titleColor: "var(--brand-hadal)",
		textColor: "var(--brand-abyssal)",
	},
	tip: {
		bg: "var(--brand-sand-overlay-strong)",
		borderColor: "var(--brand-sunlight)",
		icon: <IconBulb size={20} color="var(--brand-abyssal)" />,
		titleColor: "var(--brand-hadal)",
		textColor: "var(--brand-abyssal)",
	},
} as const;

const defaultConfig = {
	bg: "var(--brand-shell)",
	borderColor: "var(--brand-twilight)",
	icon: <IconInfoCircle size={20} color="var(--brand-midnight)" />,
	titleColor: "var(--brand-hadal)",
	textColor: "var(--brand-abyssal)",
};

export default function CalloutBox({
	variant,
	title,
	children,
	className = "",
}: CalloutBoxProps) {
	const styles = variantConfig[variant] ?? defaultConfig;

	return (
		<Box
			p="md"
			style={{
				backgroundColor: styles.bg,
				borderLeft: `4px solid ${styles.borderColor}`,
				borderTopRightRadius: "6px",
				borderBottomRightRadius: "6px",
			}}
			className={className}
		>
			<Group align="flex-start" gap="xs" wrap="nowrap">
				<Box mt={2} style={{ flexShrink: 0 }}>
					{styles.icon}
				</Box>
				<Box>
					{title && (
						<Text
							fw={600}
							size="sm"
							mb={4}
							style={{ color: styles.titleColor }}
						>
							{title}
						</Text>
					)}
					<Text size="sm" style={{ color: styles.textColor, lineHeight: 1.6 }}>
						{children}
					</Text>
				</Box>
			</Group>
		</Box>
	);
}
