import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback } from "react";
import { AuthProvider } from "@/auth/AuthContext";
import DocumentTitle from "@/components/DocumentTitle";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { emptyProjectState, type ProjectState } from "@/workspace/types";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
import { router } from "./router";

/**
 * One editing session per active project; switching remounts it with that project's state.
 * Edits are bound to the project that made them. With no project the session is blank and
 * its edits go nowhere.
 */
function ActiveProjectSession() {
  const { activeProject, updateProject } = useWorkspace();
  const id = activeProject?.id ?? null;
  const onChange = useCallback(
    (state: ProjectState) => {
      if (id) updateProject(id, state);
    },
    [id, updateProject],
  );
  return (
    <AppStateProvider
      key={id ?? "empty"}
      initialState={activeProject?.state ?? emptyProjectState()}
      onChange={id ? onChange : undefined}
    >
      <DocumentTitle />
      <RouterProvider router={router} />
    </AppStateProvider>
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications />
      <AuthProvider>
        <WorkspaceProvider>
          <ActiveProjectSession />
        </WorkspaceProvider>
      </AuthProvider>
    </MantineProvider>
  );
}
