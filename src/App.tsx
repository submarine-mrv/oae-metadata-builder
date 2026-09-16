import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "@tanstack/react-router";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { emptyProjectState } from "@/workspace/types";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
import { router } from "./router";

/**
 * One editing session per active project; switching remounts it with that project's state.
 * With no project the session is blank and its changes go nowhere; the welcome screen is
 * the only thing that renders inside it.
 */
function ActiveProjectSession() {
  const { activeProjectId, activeProject, updateActiveProject } = useWorkspace();
  return (
    <AppStateProvider
      key={activeProjectId ?? "empty"}
      initialState={activeProject?.state ?? emptyProjectState()}
      onChange={activeProject ? updateActiveProject : undefined}
    >
      <RouterProvider router={router} />
    </AppStateProvider>
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <WorkspaceProvider>
        <ActiveProjectSession />
      </WorkspaceProvider>
    </MantineProvider>
  );
}
