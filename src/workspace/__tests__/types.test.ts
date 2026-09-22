import { describe, expect, it } from "vitest";
import {
  documentTitle,
  emptyProjectState,
  newProjectRecord,
  projectDisplayName,
  UNNAMED_PROJECT,
} from "../types";

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

describe("documentTitle", () => {
  it("is the product name for an unnamed project", () => {
    expect(documentTitle(emptyProjectState())).toBe("OAE Metadata Builder");
  });

  it("leads with the project name once it has one", () => {
    const state = {
      ...emptyProjectState(),
      projectData: { project_id: "", research_project: "Kiel trial" },
    };
    expect(documentTitle(state)).toBe("Kiel trial · OAE Metadata Builder");
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
