import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_KEY } from "@/workspace/storage";
import { emptyProjectState, newProjectRecord } from "@/workspace/types";
import { useWorkspace, WorkspaceProvider } from "@/workspace/WorkspaceContext";
import RestorePrompt, { RESTORE_PROMPTED_KEY } from "../RestorePrompt";

function Probe() {
  const { projects } = useWorkspace();
  return <output>{projects.length}</output>;
}

function seed(count: number) {
  const projects = Array.from({ length: count }, () => newProjectRecord(emptyProjectState()));
  localStorage.setItem(
    WORKSPACE_KEY,
    JSON.stringify({ version: 1, activeProjectId: projects[0]?.id ?? null, projects }),
  );
}

function renderPrompt() {
  return render(
    <MantineProvider>
      <WorkspaceProvider>
        <Probe />
        <RestorePrompt />
      </WorkspaceProvider>
    </MantineProvider>,
  );
}

describe("RestorePrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stays hidden with nothing saved, and marks the tab as asked", () => {
    renderPrompt();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(RESTORE_PROMPTED_KEY)).not.toBeNull();
  });

  it("asks once per tab when projects are saved", async () => {
    seed(2);
    const { unmount } = renderPrompt();
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText(/2 projects saved/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Restore session" }));
    expect(screen.getByRole("status")).toHaveTextContent("2");
    unmount();

    renderPrompt();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("focuses Restore session on open and Back on the confirm step", async () => {
    seed(1);
    renderPrompt();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Restore session" })).toHaveFocus(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Start fresh" }));
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
  });

  it("has no close button; Escape restores, or backs out of the confirm step", async () => {
    seed(1);
    renderPrompt();
    await screen.findByText("Welcome back");
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Start fresh" }));
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Welcome back")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("1");
  });

  it("asks again after a reload that left the prompt unanswered", async () => {
    seed(1);
    const { unmount } = renderPrompt();
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    unmount();

    renderPrompt();
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });

  it("removes every project only after the confirm step", async () => {
    seed(2);
    renderPrompt();
    await userEvent.click(await screen.findByRole("button", { name: "Start fresh" }));
    expect(screen.getByText(/removes 2 projects/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2");

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Start fresh" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove all projects" }));
    expect(screen.getByRole("status")).toHaveTextContent("0");
  });
});
