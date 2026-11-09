import { createRouter } from "@tanstack/react-router";
import { authStore } from "./auth/authStore";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: { auth: authStore },
  defaultPreload: "intent",
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
  for (const to of ["/overview", "/project", "/experiment", "/dataset", "/projects"] as const) {
    router.preloadRoute({ to }).catch(() => {});
  }
}
