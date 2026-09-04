import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StandardIdentifierField from "../StandardIdentifierField";

// Own file because the mock applies to the whole module for every test in it.
vi.mock("@/data/cf/cfStandardNames", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/cf/cfStandardNames")>();
  return { ...actual, loadCfIndex: vi.fn() };
});

import { CF_SHORTLIST_ENTRIES, loadCfIndex } from "@/data/cf/cfStandardNames";

const ROOT_SCHEMA = { $defs: { Var: { type: "object", properties: {} } } };

const AIR = { name: "air_temperature", uri: "http://x/A/", units: "K" };
const INDEX = {
  entries: [AIR],
  aliases: [],
  byName: new Map([[AIR.name, AIR]]),
  cfTableVersion: "test",
};

const trigger = () => screen.getByRole("button", { name: "CF standard name" });
const hidden = { hidden: true } as const;

describe("StandardIdentifierField — index load failure", () => {
  it("stops loading, keeps Other and clear reachable, and recovers on retry", async () => {
    const mocked = vi.mocked(loadCfIndex);
    mocked.mockRejectedValueOnce(new Error("chunk failed"));
    mocked.mockResolvedValueOnce(INDEX);

    render(
      <MantineProvider>
        <StandardIdentifierField
          fieldPath="standard_identifier"
          variableSchema={ROOT_SCHEMA.$defs.Var}
          rootSchema={ROOT_SCHEMA}
          formData={{ standard_identifier: { term: "air_temperature", uri: "http://x/A/" } }}
          onSelect={vi.fn()}
          shortlist={null}
        />
      </MantineProvider>,
    );

    fireEvent.click(trigger());
    await waitFor(() => {
      expect(screen.getByText(/Could not load the CF standard name list/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading CF standard names/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear standard name" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Other/, ...hidden })).toBeInTheDocument();
    // Unknown, not retired: the off-list warning stays quiet.
    expect(screen.queryByText(/not in the current CF standard name table/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry", ...hidden }));
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /air_temperature/, ...hidden }),
      ).toBeInTheDocument();
    });
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it("forgets the failure when a later visit to the full list loads", async () => {
    const mocked = vi.mocked(loadCfIndex);
    mocked.mockRejectedValueOnce(new Error("chunk failed"));
    mocked.mockResolvedValueOnce(INDEX);
    const shortlist = CF_SHORTLIST_ENTRIES.slice(0, 2);

    render(
      <MantineProvider>
        <StandardIdentifierField
          fieldPath="standard_identifier"
          variableSchema={ROOT_SCHEMA.$defs.Var}
          rootSchema={ROOT_SCHEMA}
          formData={{}}
          onSelect={vi.fn()}
          shortlist={shortlist}
          typeLabel="pH"
        />
      </MantineProvider>,
    );

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: /Search all standard names/, ...hidden }));
    await waitFor(() => {
      expect(screen.getByText(/Could not load the CF standard name list/)).toBeInTheDocument();
    });

    // Leaving the full list and coming back is a fresh load, which succeeds.
    fireEvent.click(screen.getByRole("button", { name: /Back to suggested names/, ...hidden }));
    fireEvent.click(screen.getByRole("button", { name: /Search all standard names/, ...hidden }));
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /air_temperature/, ...hidden }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Could not load the CF standard name list/)).not.toBeInTheDocument();
  });
});
