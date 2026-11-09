import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import type { ProjectAccess } from "@/workspace/projectCloudSync";
import { projectAccessAtom } from "@/workspace/syncState";
import { newProjectRecord } from "@/workspace/types";
import ViewOnlyBadge from "../ViewOnlyBadge";

function renderBadge(role?: ProjectAccess["role"]) {
  const store = createStore();
  const project = { ...newProjectRecord(), id: "p" };
  store.set(workspaceAtom, { version: 1, activeProjectId: "p", projects: [project] });
  if (role) {
    store.set(projectAccessAtom, {
      p: { role, ownerEmail: "o@example.com", updatedByEmail: null, memberCount: 1 },
    });
  }
  render(
    <MantineProvider>
      <Provider store={store}>
        <ViewOnlyBadge />
      </Provider>
    </MantineProvider>,
  );
}

describe("ViewOnlyBadge", () => {
  it("marks a project the user can only view", () => {
    renderBadge("viewer");
    expect(screen.getByText("View only")).toBeInTheDocument();
  });

  it("stays hidden for editors, owners and guests", () => {
    for (const role of ["editor", "owner", undefined] as const) {
      renderBadge(role);
    }
    expect(screen.queryByText("View only")).not.toBeInTheDocument();
  });
});
