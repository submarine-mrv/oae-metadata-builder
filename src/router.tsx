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
    // The slug routes need params to preload as locations; their code is all that's wanted.
    for (const id of [
      "/projects/$projectId",
      "/projects/$projectId/",
      "/projects/$projectId/metadata",
      "/projects/$projectId/experiments/$experimentId",
      "/projects/$projectId/datasets/$datasetId",
    ] as const) {
      router.loadRouteChunk(router.routesById[id])?.catch(() => {});
    }
  });
}
