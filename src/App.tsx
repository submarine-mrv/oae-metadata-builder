import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { RouterProvider } from "@tanstack/react-router";
import { Provider } from "jotai";
import { AuthProvider } from "@/auth/AuthContext";
import DocumentTitle from "@/components/DocumentTitle";
import { appStore } from "@/state/store";
import { theme } from "@/theme";
import WorkspaceSyncController from "@/workspace/WorkspaceSyncController";
import { router } from "./router";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications />
      <AuthProvider>
        <Provider store={appStore}>
          <WorkspaceSyncController>
            <DocumentTitle />
            <RouterProvider router={router} />
          </WorkspaceSyncController>
        </Provider>
      </AuthProvider>
    </MantineProvider>
  );
}
