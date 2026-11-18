import { createRouter } from "@tanstack/react-router";
import NotFoundPage from "@/pages/not-found/NotFoundPage";
import { authStore } from "./auth/authStore";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: { auth: authStore },
  defaultPreload: "intent",
  defaultNotFoundComponent: () => <NotFoundPage />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/**
 * Create and import actions update state and navigate in the same click. If the target route's code
 * is still loading, the current page repaints with the new data first, so fetch those routes up front.
 * Having them loaded also lets project switching work offline, where a failed chunk reloads the page.
 */
export function preloadEntityRoutes() {
  // Wait for the first load: preloads still in flight when its redirect lands log router errors.
  const unsubscribe = router.subscribe("onResolved", () => {
    unsubscribe();
    for (const to of ["/overview", "/project", "/experiment", "/dataset", "/projects"] as const) {
      router.preloadRoute({ to }).catch(() => {});
    }
    // Any params match these routes, which have no loaders, so this only fetches their code.
    const projectId = "_";
    for (const location of [
      { to: "/projects/$projectId", params: { projectId } },
      { to: "/projects/$projectId/metadata", params: { projectId } },
      {
        to: "/projects/$projectId/experiments/$experimentId",
        params: { projectId, experimentId: "_" },
      },
      { to: "/projects/$projectId/datasets/$datasetId", params: { projectId, datasetId: "_" } },
    ] as const) {
      router.preloadRoute(location).catch(() => {});
    }
  });
}
