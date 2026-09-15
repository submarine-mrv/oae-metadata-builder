import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "@tanstack/react-router";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
import { router } from "./router";

/** One editing session per active project; switching remounts it with that project's state. */
function ActiveProjectSession() {
  const { activeProjectId, activeProject, updateActiveProject } = useWorkspace();
  return (
    <AppStateProvider
      key={activeProjectId}
      initialState={activeProject.state}
      onChange={updateActiveProject}
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
