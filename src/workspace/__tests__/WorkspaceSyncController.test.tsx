import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkspaceSyncController from "../WorkspaceSyncController";

const { useAuthMock, cloudClient } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  cloudClient: { load: vi.fn(), save: vi.fn() },
}));

vi.mock("@/auth/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("../supabaseWorkspaceClient", () => ({ supabaseWorkspaceClient: cloudClient }));

describe("WorkspaceSyncController", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("waits for auth resolution before showing a workspace when auth is enabled", async () => {
    vi.stubEnv("VITE_AUTH_ENABLED", "true");
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      status: "loading",
      user: null,
    });
    const view = render(
      <MantineProvider>
        <Provider store={createStore()}>
          <WorkspaceSyncController>
            <div>Workspace content</div>
          </WorkspaceSyncController>
        </Provider>
      </MantineProvider>,
    );

    expect(screen.getByLabelText("Preparing workspace")).toBeInTheDocument();
    expect(screen.queryByText("Workspace content")).not.toBeInTheDocument();

    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      status: "unauthenticated",
      user: null,
    });
    view.rerender(
      <MantineProvider>
        <Provider store={createStore()}>
          <WorkspaceSyncController>
            <div>Workspace content</div>
          </WorkspaceSyncController>
        </Provider>
      </MantineProvider>,
    );

    await waitFor(() => expect(screen.getByText("Workspace content")).toBeInTheDocument());
  });

  it("keeps the local-only workspace available when auth is disabled", () => {
    vi.stubEnv("VITE_AUTH_ENABLED", "false");
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      status: "loading",
      user: null,
    });

    render(
      <MantineProvider>
        <Provider store={createStore()}>
          <WorkspaceSyncController>
            <div>Local workspace</div>
          </WorkspaceSyncController>
        </Provider>
      </MantineProvider>,
    );

    expect(screen.getByText("Local workspace")).toBeInTheDocument();
    expect(cloudClient.load).not.toHaveBeenCalled();
    expect(cloudClient.save).not.toHaveBeenCalled();
  });

  it("does not start cloud requests with auth disabled even if a session is present", () => {
    vi.stubEnv("VITE_AUTH_ENABLED", "false");
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      status: "authenticated",
      user: { id: "signed-in-user" },
    });

    render(
      <MantineProvider>
        <Provider store={createStore()}>
          <WorkspaceSyncController>
            <div>Local workspace</div>
          </WorkspaceSyncController>
        </Provider>
      </MantineProvider>,
    );

    expect(screen.getByText("Local workspace")).toBeInTheDocument();
    expect(cloudClient.load).not.toHaveBeenCalled();
    expect(cloudClient.save).not.toHaveBeenCalled();
  });
});
