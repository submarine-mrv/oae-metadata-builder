import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "@/auth/AuthContext";
import SessionManager from "@/components/SessionManager";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { router } from "./router";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications />
      <AuthProvider>
        <AppStateProvider>
          <SessionManager />
          <RouterProvider router={router} />
        </AppStateProvider>
      </AuthProvider>
    </MantineProvider>
  );
}
