import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CF_SHORTLIST_ENTRIES } from "@/data/cf/cfStandardNames";
import { getShortlistFor } from "../cfShortlists";
import StandardIdentifierField from "../StandardIdentifierField";

const ROOT_SCHEMA = {
  $defs: {
    VocabularyItemReference: {
      type: "object",
      additionalProperties: false,
      required: ["term", "uri"],
      properties: {
        term: { type: "string" },
        uri: { type: "string" },
        description: { type: "string" },
      },
    },
    Var: {
      type: "object",
      properties: { standard_identifier: { $ref: "#/$defs/VocabularyItemReference" } },
    },
  },
};

const VAR_SCHEMA = ROOT_SCHEMA.$defs.Var;

const PH = CF_SHORTLIST_ENTRIES.find((e) => e.name === "sea_water_ph_reported_on_total_scale")!;

/** The combobox trigger, distinguished from the label's tooltip icon button. */
const trigger = () => screen.getByRole("button", { name: "CF standard name" });

/**
 * jsdom never runs floating-ui's positioning, so Mantine leaves the dropdown at
 * `display: none` and the default role query treats its options as hidden.
 */
const options = () => screen.getAllByRole("option", { hidden: true });

/** Footer buttons live in that same unpositioned dropdown. */
const dropdownButton = (name: RegExp) => screen.getByRole("button", { name, hidden: true });

function renderPicker(
  formData: Record<string, unknown>,
  onSelect: (e: unknown) => void,
  shortlist = getShortlistFor("pH"),
) {
  return render(
    <MantineProvider>
      <StandardIdentifierField
        fieldPath="standard_identifier"
        variableSchema={VAR_SCHEMA}
        rootSchema={ROOT_SCHEMA}
        formData={formData}
        onSelect={onSelect}
        shortlist={shortlist}
        typeLabel="pH"
      />
    </MantineProvider>,
  );
}

describe("StandardIdentifierField — shortlist mode", () => {
  it("offers only the curated names for the type, under a Suggested heading", () => {
    renderPicker({}, vi.fn());
    fireEvent.click(trigger());

    // The curated name plus the always-present "Other".
    const labels = options().map((o) => o.textContent ?? "");
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("sea_water_ph_reported_on_total_scale");
    expect(labels[1]).toContain("Other (no standard name listed)");
    expect(screen.getByText("Suggested for pH")).toBeInTheDocument();
  });

  it("offers an escape hatch into the full CF table, and back", async () => {
    renderPicker({}, vi.fn());
    fireEvent.click(trigger());

    fireEvent.click(dropdownButton(/Search all standard names/));
    await waitFor(() => {
      expect(options().length).toBeGreaterThan(2);
    });
    expect(screen.getByPlaceholderText(/Search CF standard names/)).toBeInTheDocument();
    expect(screen.queryByText("Suggested for pH")).not.toBeInTheDocument();

    fireEvent.click(dropdownButton(/Back to suggested names/));
    await waitFor(() => {
      expect(screen.getByText("Suggested for pH")).toBeInTheDocument();
    });
    expect(options()).toHaveLength(2);
  });

  it("reports the chosen entry", () => {
    const onSelect = vi.fn();
    renderPicker({}, onSelect);
    fireEvent.click(trigger());
    fireEvent.click(options()[0]);

    expect(onSelect).toHaveBeenCalledWith(PH);
  });

  it("shows no search box when the list is curated", () => {
    renderPicker({}, vi.fn());
    fireEvent.click(trigger());
    expect(screen.queryByPlaceholderText(/Search CF standard names/)).not.toBeInTheDocument();
  });

  it("reopens on the suggestions after a visit to the full list", async () => {
    renderPicker({}, vi.fn());

    fireEvent.click(trigger());
    fireEvent.click(dropdownButton(/Search all standard names/));
    await waitFor(() => {
      expect(options().length).toBeGreaterThan(2);
    });

    // Click away, then back in.
    fireEvent.click(trigger());
    fireEvent.click(trigger());

    await waitFor(() => {
      expect(screen.getByText("Suggested for pH")).toBeInTheDocument();
    });
    expect(options()).toHaveLength(2);
    expect(screen.queryByPlaceholderText(/Search CF standard names/)).not.toBeInTheDocument();
  });

  it("reports the resolved entry for a stored full-table name", async () => {
    // The modal cannot resolve this itself — only this component loads the index —
    // and without it the unit field has no suggestions after a reopen.
    const onResolve = vi.fn();
    const term = "sea_water_ph_abiotic_analogue_reported_on_total_scale";
    render(
      <MantineProvider>
        <StandardIdentifierField
          fieldPath="standard_identifier"
          variableSchema={VAR_SCHEMA}
          rootSchema={ROOT_SCHEMA}
          formData={{ standard_identifier: { term, uri: "http://x/A/" } }}
          onSelect={vi.fn()}
          onResolve={onResolve}
          shortlist={getShortlistFor("pH")}
          typeLabel="pH"
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ name: term, units: "1" }));
    });
  });

  it("reports null for a stored name the table no longer has", async () => {
    const onResolve = vi.fn();
    render(
      <MantineProvider>
        <StandardIdentifierField
          fieldPath="standard_identifier"
          variableSchema={VAR_SCHEMA}
          rootSchema={ROOT_SCHEMA}
          formData={{ standard_identifier: { term: "some_retired_cf_name", uri: "http://x/O/" } }}
          onSelect={vi.fn()}
          onResolve={onResolve}
          shortlist={getShortlistFor("pH")}
          typeLabel="pH"
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/not in the current CF standard name table/)).toBeInTheDocument();
    });
    expect(onResolve).toHaveBeenLastCalledWith(null);
  });

  it("does not call an off-shortlist selection retired", async () => {
    // Picked from the full table, so it is a real CF name that simply is not one of
    // pH's suggestions.
    const term = "sea_water_ph_abiotic_analogue_reported_on_total_scale";
    renderPicker(
      { standard_identifier: { term, uri: "http://vocab.nerc.ac.uk/collection/P07/current/X/" } },
      vi.fn(),
    );

    expect(trigger()).toHaveTextContent(term);
    // Give the index time to load and rule the warning out.
    await waitFor(() => {
      expect(screen.queryByText(/Loading CF standard names/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/not in the current CF standard name table/)).not.toBeInTheDocument();
  });

  it("leaves the suggested list untouched by an off-shortlist selection", async () => {
    const term = "sea_water_ph_abiotic_analogue_reported_on_total_scale";
    renderPicker(
      { standard_identifier: { term, uri: "http://vocab.nerc.ac.uk/collection/P07/current/X/" } },
      vi.fn(),
    );
    fireEvent.click(trigger());

    // Just the one curated pH name plus "Other" — the selection stays in the
    // trigger, and "Search all standard names" is how you get back to it.
    await waitFor(() => {
      expect(options()).toHaveLength(2);
    });
    expect(
      options()
        .map((o) => o.textContent ?? "")
        .join(" "),
    ).not.toContain(term);
  });

  it("keeps a shortlist selection visible after switching to the full list", async () => {
    renderPicker({ standard_identifier: { term: PH.name, uri: PH.uri } }, vi.fn());
    fireEvent.click(trigger());
    fireEvent.click(dropdownButton(/Search all standard names/));

    await waitFor(() => {
      expect(options().length).toBeGreaterThan(2);
    });
    expect(trigger()).toHaveTextContent(PH.name);
    expect(screen.queryByText(/not in the current CF standard name table/)).not.toBeInTheDocument();
  });

  it("shows the canonical unit against each option", () => {
    renderPicker({}, vi.fn());
    fireEvent.click(trigger());
    expect(screen.getByText("dimensionless")).toBeInTheDocument();
  });

  it("shows the stored name and links to NVS", () => {
    renderPicker({ standard_identifier: { term: PH.name, uri: PH.uri } }, vi.fn());

    expect(trigger()).toHaveTextContent(PH.name);
    expect(screen.getByRole("link", { name: /View on NERC NVS/ })).toHaveAttribute("href", PH.uri);
  });

  it("reports null when the user picks Other", () => {
    const onSelect = vi.fn();
    renderPicker({ standard_identifier: { term: PH.name, uri: PH.uri } }, onSelect);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("Other (no standard name listed)"));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows Other as the selection even though nothing is stored", () => {
    // Purely a UI affordance for someone who wants every field answered — it writes
    // no standard_identifier, so `formData` stays empty.
    const { rerender } = renderPicker({}, vi.fn());
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("Other (no standard name listed)"));

    rerender(
      <MantineProvider>
        <StandardIdentifierField
          fieldPath="standard_identifier"
          variableSchema={VAR_SCHEMA}
          rootSchema={ROOT_SCHEMA}
          formData={{}}
          onSelect={vi.fn()}
          shortlist={getShortlistFor("pH")}
          typeLabel="pH"
        />
      </MantineProvider>,
    );

    expect(trigger()).toHaveTextContent("Other (no standard name listed)");
  });

  it("clears a selection from the input", () => {
    const onSelect = vi.fn();
    renderPicker({ standard_identifier: { term: PH.name, uri: PH.uri } }, onSelect);

    const clear = screen.getByRole("button", { name: "Clear standard name" });
    // It sits beside the trigger, not inside it, which is what stops its click from
    // bubbling into the trigger's toggle and reopening the dropdown.
    expect(trigger().contains(clear)).toBe(false);

    fireEvent.click(clear);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("clears the Other state too", () => {
    renderPicker({}, vi.fn());
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText("Other (no standard name listed)"));
    expect(trigger()).toHaveTextContent("Other (no standard name listed)");

    fireEvent.click(screen.getByRole("button", { name: "Clear standard name" }));

    expect(trigger()).toHaveTextContent("Select a CF standard name…");
  });

  it("offers no clear button when nothing is selected", () => {
    renderPicker({}, vi.fn());
    expect(screen.queryByRole("button", { name: "Clear standard name" })).not.toBeInTheDocument();
  });

  it("always offers Other, including with nothing selected", () => {
    renderPicker({}, vi.fn());
    fireEvent.click(trigger());
    expect(screen.getByText("Other (no standard name listed)")).toBeInTheDocument();
  });

  it("links out to the CF Conventions website", () => {
    renderPicker({}, vi.fn());

    expect(screen.getByRole("link", { name: /CF Conventions website/ })).toHaveAttribute(
      "href",
      "https://cfconventions.org/Data/cf-standard-names/current/build/cf-standard-name-table.html",
    );
  });
});

describe("StandardIdentifierField — stored value outside the list", () => {
  it("keeps an off-list name rather than blanking it", async () => {
    renderPicker(
      { standard_identifier: { term: "some_retired_cf_name", uri: "http://x/OLD/" } },
      vi.fn(),
    );

    expect(trigger()).toHaveTextContent("some_retired_cf_name");
    // The warning waits on the index: a name missing from the shortlist is only
    // retired once the full table has been checked and come up empty.
    await waitFor(() => {
      expect(screen.getByText(/not in the current CF standard name table/)).toBeInTheDocument();
    });
  });

  it("says nothing about off-list names for a recognised selection", () => {
    renderPicker({ standard_identifier: { term: PH.name, uri: PH.uri } }, vi.fn());
    expect(screen.queryByText(/not in the current CF standard name table/)).not.toBeInTheDocument();
  });
});

describe("StandardIdentifierField — full list mode", () => {
  it("searches the whole CF table with underscores or spaces", async () => {
    renderPicker({}, vi.fn(), null);
    fireEvent.click(trigger());

    const search = await screen.findByPlaceholderText(/Search CF standard names/);
    fireEvent.change(search, { target: { value: "partial pressure carbon dioxide in sea" } });

    await waitFor(() => {
      expect(
        screen.getByText("partial_pressure_of_carbon_dioxide_in_sea_water"),
      ).toBeInTheDocument();
    });
  });

  it("caps the rendered options and says how many matched", async () => {
    renderPicker({}, vi.fn(), null);
    fireEvent.click(trigger());
    await screen.findByPlaceholderText(/Search CF standard names/);

    await waitFor(() => {
      expect(screen.getByText(/Showing 100 of \d+ matches/)).toBeInTheDocument();
    });
    // The 100 capped CF names plus the always-present "Other".
    expect(options().length).toBe(101);
  });

  it("resolves a retired name through its alias", async () => {
    renderPicker({}, vi.fn(), null);
    fireEvent.click(trigger());

    const search = await screen.findByPlaceholderText(/Search CF standard names/);
    // "so4" appears in no current CF name, so this only resolves via the alias.
    fireEvent.change(search, { target: { value: "atmosphere_so4_content" } });

    await waitFor(() => {
      expect(
        screen.getByText("atmosphere_so4_content → atmosphere_mass_content_of_sulfate"),
      ).toBeInTheDocument();
    });
  });

  it("ranks a direct name match above the alias that points at it", async () => {
    renderPicker({}, vi.fn(), null);
    fireEvent.click(trigger());

    const search = await screen.findByPlaceholderText(/Search CF standard names/);
    fireEvent.change(search, {
      target: { value: "mass_concentration_of_chlorophyll_in_sea_water" },
    });

    await waitFor(() => {
      expect(options()[0]).toHaveTextContent("mass_concentration_of_chlorophyll_in_sea_water");
    });
  });
});
