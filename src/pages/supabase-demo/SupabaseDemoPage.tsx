import { useMemo, useState } from "react";
import {
	Alert,
	Badge,
	Button,
	Card,
	Code,
	Container,
	Group,
	Loader,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import type { SampleItem } from "@/types/sampleItems";
import {
	fetchSampleItems,
	updateSampleItemById,
} from "@/utils/supabase/sampleItems";

const sampleItemsQueryKey = ["sample_items"] as const;
const preferredEditableKeys = ["name", "title", "label", "description"];

type DraftMap = Record<number, string>;

function findEditableField(item: SampleItem): string | null {
	const keys = Object.keys(item);

	for (const key of preferredEditableKeys) {
		if (typeof item[key] === "string") {
			return key;
		}
	}

	for (const key of keys) {
		if (key === "id") {
			continue;
		}

		if (typeof item[key] === "string") {
			return key;
		}
	}

	return null;
}

export default function SupabaseDemoPage() {
	const queryClient = useQueryClient();
	const [drafts, setDrafts] = useState<DraftMap>({});
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const sampleItemsQuery = useQuery({
		queryKey: sampleItemsQueryKey,
		queryFn: fetchSampleItems,
		staleTime: 30_000,
	});

	const updateItemMutation = useMutation({
		mutationFn: async ({
			id,
			field,
			value,
		}: {
			id: number;
			field: string;
			value: string;
		}) => {
			return updateSampleItemById(id, { [field]: value });
		},
		onSuccess: async (updatedRow) => {
			setSuccessMessage(`Updated row ${updatedRow.id} successfully.`);
			await queryClient.invalidateQueries({ queryKey: sampleItemsQueryKey });
		},
	});

	const rows = sampleItemsQuery.data ?? [];
	const editableFieldById = useMemo(() => {
		return rows.reduce<Record<number, string | null>>((acc, item) => {
			acc[item.id] = findEditableField(item);
			return acc;
		}, {});
	}, [rows]);

	return (
		<AppLayout>
			<Container size="lg" py="xl">
				<Stack gap="lg">
					<Group justify="space-between" align="center">
						<div>
							<Title order={1}>Supabase Demo: sample_items</Title>
							<Text c="dimmed" size="sm">
								Data is fetched with TanStack Query and updated using a typed
								Supabase mutation.
							</Text>
						</div>
						<Button
							variant="light"
							onClick={() => {
								setSuccessMessage(null);
								sampleItemsQuery.refetch();
							}}
							loading={sampleItemsQuery.isFetching}
						>
							Refresh
						</Button>
					</Group>

					{successMessage && (
						<Alert icon={<IconCheck size={16} />} color="green" variant="light">
							{successMessage}
						</Alert>
					)}

					{sampleItemsQuery.isLoading ? (
						<Group justify="center" py="xl">
							<Loader />
						</Group>
					) : sampleItemsQuery.isError ? (
						<Alert
							icon={<IconAlertCircle size={16} />}
							color="red"
							title="Failed to load sample_items"
						>
							{sampleItemsQuery.error instanceof Error
								? sampleItemsQuery.error.message
								: "Unknown query error"}
						</Alert>
					) : rows.length === 0 ? (
						<Alert color="blue" variant="light" title="No rows found">
							The sample_items table returned zero records.
						</Alert>
					) : (
						<Card withBorder radius="md" padding="md">
							<Stack gap="md">
								<Group justify="space-between" align="center">
									<Text fw={600}>Rows</Text>
									<Badge variant="light">{rows.length} item(s)</Badge>
								</Group>

								<Table striped highlightOnHover withTableBorder>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>ID</Table.Th>
											<Table.Th>Editable field</Table.Th>
											<Table.Th>Current value</Table.Th>
											<Table.Th>New value</Table.Th>
											<Table.Th>Action</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{rows.map((item) => {
											const editableField = editableFieldById[item.id];
											const currentValue =
												editableField && typeof item[editableField] === "string"
													? (item[editableField] as string)
													: "";
											const draftValue =
												drafts[item.id] !== undefined
													? drafts[item.id]
													: currentValue;
											const disableSave =
												!editableField ||
												updateItemMutation.isPending ||
												draftValue === currentValue;

											return (
												<Table.Tr key={item.id}>
													<Table.Td>{item.id}</Table.Td>
													<Table.Td>
														{editableField ? (
															<Code>{editableField}</Code>
														) : (
															<Text c="dimmed" size="sm">
																No string field available
															</Text>
														)}
													</Table.Td>
													<Table.Td>
														<Text size="sm">{currentValue || "-"}</Text>
													</Table.Td>
													<Table.Td>
														<TextInput
															placeholder={
																editableField
																	? `Update ${editableField}`
																	: "Not editable"
															}
															disabled={!editableField}
															value={draftValue}
															onChange={(event) => {
																const next = event.currentTarget.value;
																setDrafts((prev) => ({
																	...prev,
																	[item.id]: next,
																}));
															}}
														/>
													</Table.Td>
													<Table.Td>
														<Button
															size="xs"
															loading={updateItemMutation.isPending}
															disabled={disableSave}
															onClick={() => {
																if (!editableField) {
																	return;
																}

																setSuccessMessage(null);
																updateItemMutation.mutate({
																	id: item.id,
																	field: editableField,
																	value: draftValue,
																});
															}}
														>
															Save
														</Button>
													</Table.Td>
												</Table.Tr>
											);
										})}
									</Table.Tbody>
								</Table>
							</Stack>
						</Card>
					)}

					{updateItemMutation.isError && (
						<Alert
							icon={<IconAlertCircle size={16} />}
							color="red"
							title="Update failed"
						>
							{updateItemMutation.error instanceof Error
								? updateItemMutation.error.message
								: "Unknown mutation error"}
						</Alert>
					)}
				</Stack>
			</Container>
		</AppLayout>
	);
}
