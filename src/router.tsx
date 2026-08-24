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
