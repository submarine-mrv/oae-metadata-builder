import { describe, expect, it } from "vitest";
import { emptyProjectState, newProjectRecord, projectDisplayName, UNNAMED_PROJECT } from "../types";

describe("projectDisplayName", () => {
  it("falls back to Unnamed Project when there is no name", () => {
    expect(projectDisplayName(emptyProjectState())).toBe(UNNAMED_PROJECT);
    expect(
      projectDisplayName({
        ...emptyProjectState(),
        projectData: { project_id: "", research_project: "   " },
      }),
    ).toBe(UNNAMED_PROJECT);
  });

  it("uses the trimmed Research Project name", () => {
    const state = {
      ...emptyProjectState(),
      projectData: { project_id: "", research_project: "  Kiel trial " },
    };
    expect(projectDisplayName(state)).toBe("Kiel trial");
  });
});

describe("newProjectRecord", () => {
  it("gives every record a unique id and matching timestamps", () => {
    const a = newProjectRecord(undefined, 1000);
    const b = newProjectRecord(undefined, 1000);
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBe(1000);
    expect(a.updatedAt).toBe(1000);
    expect(a.state).toEqual(emptyProjectState());
  });
});
