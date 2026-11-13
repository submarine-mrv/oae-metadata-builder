import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareProjectModal from "../ShareProjectModal";

const members = vi.hoisted(() => ({
  list: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  user: { id: "u1", email: "Me@Example.com" },
}));
vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ user: members.user }) }));
vi.mock("@/auth/providers/supabase/projectClient", () => ({
  createProjectMembersClient: () => members,
}));

function renderModal(isOwner: boolean) {
  const onClose = vi.fn();
  const onLeft = vi.fn();
  render(
    <MantineProvider>
      <Provider store={createStore()}>
        <ShareProjectModal projectId="p" isOwner={isOwner} onClose={onClose} onLeft={onLeft} />
      </Provider>
    </MantineProvider>,
  );
  return { onClose, onLeft };
}

describe("ShareProjectModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    members.list.mockResolvedValue([
      { email: "owner@example.com", role: "owner" },
      { email: "bob@example.com", role: "editor" },
      { email: "me@example.com", role: "viewer" },
    ]);
    members.set.mockResolvedValue(undefined);
    members.remove.mockResolvedValue(undefined);
  });

  it("lets the owner add someone by email with a role", async () => {
    renderModal(true);
    await screen.findByText("bob@example.com");
    fireEvent.change(screen.getByLabelText("Add by email"), {
      target: { value: "  new@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(members.set).toHaveBeenCalledWith("p", "new@example.com", "editor"));
    expect(members.list).toHaveBeenCalledTimes(2);
  });

  it("lets the owner remove a member", async () => {
    renderModal(true);
    fireEvent.click(await screen.findByRole("button", { name: "Remove bob@example.com" }));
    await waitFor(() => expect(members.remove).toHaveBeenCalledWith("p", "bob@example.com"));
  });

  it("shows members a read-only list and lets them leave", async () => {
    const { onLeft } = renderModal(false);
    expect(await screen.findByText("me@example.com (you)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add by email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave project" }));
    await waitFor(() => expect(members.remove).toHaveBeenCalledWith("p", "Me@Example.com"));
    await waitFor(() => expect(onLeft).toHaveBeenCalled());
  });

  it("shows why a change failed", async () => {
    members.set.mockRejectedValueOnce(new Error("Could not add this person: denied"));
    renderModal(true);
    await screen.findByText("bob@example.com");
    fireEvent.change(screen.getByLabelText("Add by email"), { target: { value: "x@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Could not add this person: denied")).toBeInTheDocument();
  });
});
