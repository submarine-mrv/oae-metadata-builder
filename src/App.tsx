import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import SessionManager from "@/components/SessionManager";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { router } from "./router";

export default function App() {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnWindowFocus: false,
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<MantineProvider theme={theme} defaultColorScheme="light">
				<AppStateProvider>
					<SessionManager />
					<RouterProvider router={router} />
				</AppStateProvider>
			</MantineProvider>
		</QueryClientProvider>
	);
}
