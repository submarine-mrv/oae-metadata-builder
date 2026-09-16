import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider, useAppState } from "@/contexts/AppStateContext";
import { WorkspaceProvider } from "@/workspace/WorkspaceContext";
import AppLayout from "../AppLayout";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: ({ select }: { select?: (s: { pathname: string }) => unknown }) =>
    select ? select({ pathname: "/overview" }) : { pathname: "/overview" },
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

function Namer() {
  const { createProject, updateProjectData } = useAppState();
  return (
    <button
      type="button"
      onClick={() => {
        createProject();
        updateProjectData({ project_id: "", research_project: "Kiel trial" });
      }}
    >
      name
    </button>
  );
}

describe("AppLayout document title", () => {
  beforeEach(() => {
    localStorage.clear();
    document.title = "";
  });

  it("is the product name until the project is named, then leads with the name", () => {
    render(
      <MantineProvider>
        <WorkspaceProvider>
          <AppStateProvider>
            <AppLayout>
              <Namer />
            </AppLayout>
          </AppStateProvider>
        </WorkspaceProvider>
      </MantineProvider>,
    );
    expect(document.title).toBe("OAE Metadata Builder");
    act(() => screen.getByText("name").click());
    expect(document.title).toBe("Kiel trial · OAE Metadata Builder");
  });
});
