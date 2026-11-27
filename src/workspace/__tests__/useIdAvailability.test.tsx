import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceAtom } from "@/state/atoms";
import { createTestStore } from "@/state/testing";
import type { IdConflict } from "../supabasePublicationClient";
import { emptyProjectState, newProjectRecord } from "../types";
import { useIdAvailability } from "../useIdAvailability";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  user: { id: "owner" } as { id: string } | null,
}));
vi.mock("@/auth/config", () => ({ authEnabled: true, authProvider: "supabase" }));
vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../supabasePublicationClient", () => ({
  createPublicationClient: () => ({ checkIds: mocks.check }),
}));

const EXPERIMENT = "0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3";

function setup(kind: "project" | "experiment" = "project", withExperiment = false) {
  const state = emptyProjectState();
  const project = {
    ...newProjectRecord(
      withExperiment
        ? {
            ...state,
            experiments: [
              { id: EXPERIMENT, name: "Site", createdAt: 0, updatedAt: 0, formData: {} },
            ],
          }
        : state,
    ),
    id: "draft",
  };
  const store = createTestStore({ version: 1, activeProjectId: project.id, projects: [project] });
  const view = renderHook(({ value, focused }) => useIdAvailability(kind, value, focused, true), {
    initialProps: { value: "TAKEN", focused: false },
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    ),
  });
  return { ...view, store };
}

describe("advisory ID availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "owner" };
    mocks.check.mockResolvedValue([]);
  });

  it("checks loaded IDs, warns without modifying the draft, and recovers after editing", async () => {
    mocks.check.mockResolvedValueOnce([{ entity_type: "project", id: "TAKEN", reason: "in_use" }]);
    const { result, rerender, store } = setup();
    const original = store.get(workspaceAtom);
    await waitFor(() =>
      expect(result.current.message).toBe(
        "This ID is already in use. Choose a unique ID before publishing.",
      ),
    );
    expect(store.get(workspaceAtom)).toBe(original);
    expect(mocks.check).toHaveBeenCalledWith("draft", "TAKEN", []);
    rerender({ value: "FREE", focused: true });
    expect(result.current.message).toBeNull();
    expect(mocks.check).toHaveBeenCalledTimes(1);
    rerender({ value: "FREE", focused: false });
    await waitFor(() => expect(mocks.check).toHaveBeenCalledWith("draft", "FREE", []));
    expect(result.current.message).toBeNull();
  });

  it.each([
    ["duplicate", "This ID is used more than once in this project."],
    ["renamed", "published IDs can't change"],
  ] as const)("checks an experiment ID by its UUID and explains a %s conflict", async (reason, message) => {
    mocks.check.mockResolvedValueOnce([{ entity_type: "experiment", id: "taken", reason }]);
    const { result } = setup("experiment", true);
    await waitFor(() => expect(result.current.message).toContain(message));
    expect(mocks.check).toHaveBeenCalledWith("draft", "", [{ uuid: EXPERIMENT, id: "TAKEN" }]);
  });

  it("ignores a stale response after the ID changes", async () => {
    let resolve!: (value: IdConflict[]) => void;
    mocks.check.mockImplementationOnce(
      () =>
        new Promise<IdConflict[]>((done) => {
          resolve = done;
        }),
    );
    const { result, rerender } = setup();
    await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1));
    rerender({ value: "FREE", focused: false });
    await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(2));
    await act(async () => resolve([{ entity_type: "project", id: "TAKEN", reason: "in_use" }]));
    expect(result.current.message).toBeNull();
  });

  it("surfaces failures and lets the user retry without changing metadata", async () => {
    mocks.check.mockRejectedValueOnce(new Error("network unavailable"));
    const { result } = setup();
    await waitFor(() => expect(result.current.message).toContain("network unavailable"));
    act(() => result.current.retry());
    await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.message).toBeNull());
  });

  it("warns about case-insensitive duplicates within guest drafts without an RPC", async () => {
    mocks.user = null;
    const { store, result, rerender } = setup("experiment");
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((project) => ({
          ...project,
          state: {
            ...project.state,
            experiments: ["one", "two"].map((id) => ({
              id,
              name: id,
              createdAt: 0,
              updatedAt: 0,
              formData: { experiment_id: "taken" },
            })),
          },
        })),
      })),
    );
    await waitFor(() => expect(result.current.message).toContain("Another experiment"));
    expect(mocks.check).not.toHaveBeenCalled();
    rerender({ value: "", focused: false });
    expect(result.current.message).toBeNull();
  });

  it.each([
    ["project", "An experiment in this project has this ID."],
    ["experiment", "The project has this ID."],
  ] as const)("warns when the %s ID matches the other entity type in the draft", (kind, message) => {
    mocks.user = null;
    const { store, result } = setup(kind);
    act(() =>
      store.set(workspaceAtom, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((project) => ({
          ...project,
          state: {
            ...project.state,
            projectData: { project_id: "taken" },
            experiments: [
              {
                id: "one",
                name: "one",
                createdAt: 0,
                updatedAt: 0,
                formData: { experiment_id: "taken" },
              },
            ],
          },
        })),
      })),
    );
    expect(result.current.message).toContain(message);
    expect(mocks.check).not.toHaveBeenCalled();
  });
});
