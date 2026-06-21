import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "@tanstack/react-router";
import SessionManager from "@/components/SessionManager";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { router } from "./router";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <AppStateProvider>
        <SessionManager />
        <RouterProvider router={router} />
      </AppStateProvider>
    </MantineProvider>
  );
}
