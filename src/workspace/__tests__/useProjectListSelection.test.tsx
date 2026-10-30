import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectAtom, switchProjectAtom } from "@/state/actions";
import { activeProjectIdAtom, workspaceAtom } from "@/state/atoms";
import { createTestStore, makeWrapper } from "@/state/testing";
import { useProjectListSelection } from "../useProjectListSelection";

const route = vi.hoisted(() => ({ pathname: "/projects" }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (location: { pathname: string }) => string }) =>
    select(route),
}));

describe("All projects selection", () => {
  beforeEach(() => {
    route.pathname = "/projects";
  });

  it("clears only on list entry and lets a project open without being cleared again", () => {
    const store = createTestStore();
    const id = store.set(createProjectAtom);
    const projects = store.get(workspaceAtom).projects;
    const { rerender } = renderHook(useProjectListSelection, { wrapper: makeWrapper(store) });
    expect(store.get(activeProjectIdAtom)).toBeNull();
    expect(store.get(workspaceAtom).projects).toBe(projects);
    act(() => store.set(switchProjectAtom, id));
    rerender();
    expect(store.get(activeProjectIdAtom)).toBe(id);
    route.pathname = "/overview";
    rerender();
    expect(store.get(activeProjectIdAtom)).toBe(id);
    route.pathname = "/projects";
    rerender();
    expect(store.get(activeProjectIdAtom)).toBeNull();
  });
});
