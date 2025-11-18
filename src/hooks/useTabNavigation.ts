import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/contexts/AppStateContext";

type TabName = "overview" | "project" | "experiment";

interface TabRoute {
  name: TabName;
  path: string;
}

const TAB_ROUTES: Record<string, TabRoute> = {
  overview: { name: "overview", path: "/overview" },
  project: { name: "project", path: "/project" },
  experiment: { name: "experiment", path: "/experiment" }
};

interface UseTabNavigationReturn {
  navigateToTab: (tabKey: keyof typeof TAB_ROUTES, experimentId?: number) => void;
  navigateToOverview: () => void;
  navigateToProject: () => void;
  navigateToExperiment: (experimentId?: number) => void;
}

export function useTabNavigation(): UseTabNavigationReturn {
  const router = useRouter();
  const { setActiveTab, setActiveExperiment } = useAppState();

  const navigateToTab = useCallback(
    (tabKey: keyof typeof TAB_ROUTES, experimentId?: number) => {
      const route = TAB_ROUTES[tabKey];
      setActiveTab(route.name);
      if (experimentId !== undefined) {
        setActiveExperiment(experimentId);
      }
      router.push(route.path);
    },
    [router, setActiveTab, setActiveExperiment]
  );

  const navigateToOverview = useCallback(() => {
    navigateToTab("overview");
  }, [navigateToTab]);

  const navigateToProject = useCallback(() => {
    navigateToTab("project");
  }, [navigateToTab]);

  const navigateToExperiment = useCallback((experimentId?: number) => {
    navigateToTab("experiment", experimentId);
  }, [navigateToTab]);

  return {
    navigateToTab,
    navigateToOverview,
    navigateToProject,
    navigateToExperiment
  };
}
