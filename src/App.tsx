import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { RouterProvider } from "@tanstack/react-router";
import { Provider } from "jotai";
import { AuthProvider } from "@/auth/AuthContext";
import DocumentTitle from "@/components/DocumentTitle";
import { appStore } from "@/state/store";
import { theme } from "@/theme";
import ProjectPersistenceController from "@/workspace/ProjectPersistenceController";
import { router } from "./router";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="bottom-right" autoClose={5000} />
      <AuthProvider>
        <Provider store={appStore}>
          <ProjectPersistenceController>
            <DocumentTitle />
            <RouterProvider router={router} />
          </ProjectPersistenceController>
        </Provider>
      </AuthProvider>
    </MantineProvider>
  );
}
