import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "@/auth/AuthContext";
import SessionManager from "@/components/SessionManager";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { router } from "./router";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <AuthProvider>
        <AppStateProvider>
          <SessionManager />
          <RouterProvider router={router} />
        </AppStateProvider>
      </AuthProvider>
    </MantineProvider>
  );
}
