import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "@/state/atoms";
import type { ProjectAccess } from "@/workspace/projectCloudSync";
import { projectAccessAtom } from "@/workspace/syncState";
import ProjectCard from "../ProjectCard";

const summary: ProjectSummary = {
  id: "p",
  name: "Kiel trial",
  experimentCount: 1,
  datasetCount: 0,
  updatedAt: Date.now(),
  isActive: false,
};

function renderCard(access?: ProjectAccess) {
  const store = createStore();
  if (access) store.set(projectAccessAtom, { p: access });
  render(
    <MantineProvider>
      <Provider store={store}>
        <ProjectCard project={summary} onOpen={vi.fn()} onDelete={vi.fn()} />
      </Provider>
    </MantineProvider>,
  );
}

describe("ProjectCard sharing", () => {
  it("shows delete and no owner line for a project you own", () => {
    renderCard({
      role: "owner",
      ownerEmail: "me@example.com",
      updatedByEmail: null,
      memberCount: 2,
    });
    expect(screen.getByRole("button", { name: "Delete Kiel trial" })).toBeInTheDocument();
    expect(screen.queryByText(/Shared by/)).not.toBeInTheDocument();
  });

  it("names the owner and hides delete for a project shared with you", () => {
    renderCard({
      role: "viewer",
      ownerEmail: "owner@example.com",
      updatedByEmail: null,
      memberCount: 1,
    });
    expect(screen.getByText("Shared by owner@example.com · View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Kiel trial" })).not.toBeInTheDocument();
  });

  it("treats guest projects as owned", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Delete Kiel trial" })).toBeInTheDocument();
  });
});
