import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectSyncIndicator from "../sync/ProjectSyncIndicator";
import { projectSyncStatusAtom } from "../syncState";

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/auth/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/auth/config", () => ({ authEnabled: true, authProvider: "supabase" }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));

describe("cloud status indicator", () => {
  beforeEach(() => {
    auth.user = { id: "owner" };
    vi.clearAllMocks();
  });

  function setup() {
    const store = createStore();
    render(
      <MantineProvider>
        <Provider store={store}>
          <ProjectSyncIndicator />
        </Provider>
      </MantineProvider>,
    );
    return store;
  }

  it("is hidden for guests", () => {
    auth.user = null;
    setup();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a neutral cloud while pending, a green check when saved, and red X for errors", async () => {
    const store = setup();
    act(() =>
      store.set(projectSyncStatusAtom, { state: "pending", message: "Waiting for autosave" }),
    );
    expect(
      screen.getByRole("button", { name: "Cloud sync pending" }).querySelector("svg"),
    ).toHaveClass("tabler-icon-cloud");
    act(() => store.set(projectSyncStatusAtom, { state: "synced" }));
    expect(
      screen.getByRole("button", { name: "Projects synced" }).querySelector("svg"),
    ).toHaveClass("tabler-icon-cloud-check");
    act(() => store.set(projectSyncStatusAtom, { state: "error", message: "Save failed" }));
    const button = screen.getByRole("button", { name: "Project sync failed" });
    expect(button.querySelector("svg")).toHaveClass("tabler-icon-cloud-x");
    fireEvent.mouseEnter(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Save failed");
    fireEvent.click(button);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Project sync failed", color: "red" }),
    );
  });
});
