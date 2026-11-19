import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareProjectModal from "../ShareProjectModal";

const members = vi.hoisted(() => ({
  list: vi.fn(),
  invite: vi.fn(),
  resend: vi.fn(),
  setRole: vi.fn(),
  remove: vi.fn(),
  user: { id: "u1", email: "Me@Example.com" },
}));
vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ user: members.user }) }));
vi.mock("@/auth/providers/supabase/projectClient", () => ({
  createProjectMembersClient: () => members,
}));

function member(userId: string, email: string, role: string, status = "active") {
  return {
    userId,
    email,
    role,
    status,
    lastInvitedAt: status === "pending" ? "2026-09-20T10:00:00Z" : null,
  };
}

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

async function add(email: string) {
  await screen.findByText("bob@example.com");
  fireEvent.change(screen.getByLabelText("Add by email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

describe("ShareProjectModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    members.list.mockResolvedValue([
      member("o1", "owner@example.com", "owner"),
      member("b1", "bob@example.com", "editor"),
      member("u1", "me@example.com", "viewer"),
      member("p1", "pending@example.com", "viewer", "pending"),
    ]);
    members.invite.mockResolvedValue({ status: "invited", userId: "n1" });
    members.resend.mockResolvedValue({ status: "invited", userId: "p1" });
    members.setRole.mockResolvedValue(undefined);
    members.remove.mockResolvedValue(undefined);
  });

  it.each([
    "invited",
    "added",
  ] as const)("adds someone by email without a message when they are %s", async (status) => {
    members.invite.mockResolvedValueOnce({ status, userId: "n1" });
    renderModal(true);
    await add("  new@example.com ");
    await waitFor(() =>
      expect(members.invite).toHaveBeenCalledWith("p", "new@example.com", "editor"),
    );
    await waitFor(() => expect(members.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a pending person when their invitation email fails", async () => {
    members.invite.mockResolvedValueOnce({
      status: "invite_failed",
      reason: "send_failed",
      userId: "n1",
    });
    renderModal(true);
    await add("new@example.com");
    expect(
      await screen.findByText(
        "Added new@example.com, but the invitation email couldn't be sent. Try Resend.",
      ),
    ).toBeInTheDocument();
  });

  it("shows pending people with a resend control", async () => {
    renderModal(true);
    expect(await screen.findByText("Pending")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Resend invitation to pending@example.com" }),
    );
    await waitFor(() => expect(members.resend).toHaveBeenCalledWith("p", "p1"));
    await waitFor(() => expect(members.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains a resend cooldown", async () => {
    members.resend.mockRejectedValueOnce(
      Object.assign(new Error("Wait before resending"), { code: "cooldown" }),
    );
    renderModal(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Resend invitation to pending@example.com" }),
    );
    expect(
      await screen.findByText("Please wait a minute before resending this invitation."),
    ).toBeInTheDocument();
  });

  it("removes members by user ID", async () => {
    renderModal(true);
    fireEvent.click(await screen.findByRole("button", { name: "Remove bob@example.com" }));
    await waitFor(() => expect(members.remove).toHaveBeenCalledWith("p", "b1"));
  });

  it("shows members a read-only list and lets them leave", async () => {
    const { onLeft } = renderModal(false);
    expect(await screen.findByText("me@example.com (you)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add by email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove|Resend/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave project" }));
    await waitFor(() => expect(members.remove).toHaveBeenCalledWith("p", "u1"));
    await waitFor(() => expect(onLeft).toHaveBeenCalled());
  });

  it("shows why a change failed", async () => {
    members.invite.mockRejectedValueOnce(new Error("Could not add this person: denied"));
    renderModal(true);
    await add("x@example.com");
    expect(await screen.findByText("Could not add this person: denied")).toBeInTheDocument();
  });
});
