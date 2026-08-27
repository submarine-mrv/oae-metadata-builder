import { describe, expect, it } from "vitest";
import type { CfEntry } from "@/data/cf/cfStandardNames";
import { CF_SHORTLIST_ENTRIES } from "@/data/cf/cfStandardNames";
import { applyCfSelection, type CfPrefilled, clearCfSelectionOnTypeChange } from "../cfPrefill";

const byName = (name: string): CfEntry => {
  const entry = CF_SHORTLIST_ENTRIES.find((e) => e.name === name);
  if (!entry) throw new Error(`no shortlist entry for ${name}`);
  return entry;
};

const PH = byName("sea_water_ph_reported_on_total_scale");
const DIC_MASS = byName("moles_of_dissolved_inorganic_carbon_per_unit_mass_in_sea_water");
const DIC_VOLUME = byName("mole_concentration_of_dissolved_inorganic_carbon_in_sea_water");

describe("applyCfSelection", () => {
  it("writes a complete VocabularyItemReference", () => {
    const { data } = applyCfSelection({}, PH, {});
    expect(data.standard_identifier).toEqual({ term: PH.name, uri: PH.uri });
  });

  it("never writes a partial identifier", () => {
    for (const entry of CF_SHORTLIST_ENTRIES) {
      const { data } = applyCfSelection({}, entry, {});
      const ref = data.standard_identifier as Record<string, unknown>;
      expect(Object.keys(ref).sort()).toEqual(["term", "uri"]);
      expect(ref.term).toBeTruthy();
      expect(ref.uri).toBeTruthy();
    }
  });

  it("prefills long_name but deliberately not units", () => {
    const { data } = applyCfSelection({}, PH, {});
    expect(data.long_name).toBe("pH");
    // The CF canonical unit is often not what gets reported (a pH scale, PSU), so
    // the unit field suggests it rather than filling it in.
    expect(data.units).toBeUndefined();
  });

  it("never prefills dataset_variable_name", () => {
    for (const entry of CF_SHORTLIST_ENTRIES) {
      const { data } = applyCfSelection({}, entry, {});
      expect(data.dataset_variable_name).toBeUndefined();
    }
  });

  it("leaves an existing dataset_variable_name alone", () => {
    const { data } = applyCfSelection({ dataset_variable_name: "pH_total" }, PH, {});
    expect(data.dataset_variable_name).toBe("pH_total");
  });

  it("sets concentration_basis from the CF name for DIC", () => {
    expect(applyCfSelection({}, DIC_MASS, {}).data.concentration_basis).toBe("per_mass");
    expect(applyCfSelection({}, DIC_VOLUME, {}).data.concentration_basis).toBe("per_volume");
  });

  it("leaves concentration_basis unset for quantities that lack one", () => {
    expect(applyCfSelection({}, PH, {}).data.concentration_basis).toBeUndefined();
  });

  it("never touches a unit the user typed", () => {
    const first = applyCfSelection({ units: "umol kg-1" }, DIC_VOLUME, {});
    expect(first.data.units).toBe("umol kg-1");

    const second = applyCfSelection(first.data, DIC_MASS, first.prefilled);
    expect(second.data.units).toBe("umol kg-1");
    expect(second.data.standard_identifier).toEqual({ term: DIC_MASS.name, uri: DIC_MASS.uri });
  });

  it("replaces its own earlier prefill", () => {
    const first = applyCfSelection({}, DIC_VOLUME, {});
    expect(first.data.concentration_basis).toBe("per_volume");

    const second = applyCfSelection(first.data, DIC_MASS, first.prefilled);
    expect(second.data.concentration_basis).toBe("per_mass");
  });

  it("skips concentration_basis on a class that has no such field", () => {
    // ModelOutputVariable carries neither, so writing it would only be stripped again.
    const { data } = applyCfSelection({}, DIC_MASS, {}, { hasConcentrationBasis: false });

    expect(data.concentration_basis).toBeUndefined();
    expect(data.standard_identifier).toEqual({ term: DIC_MASS.name, uri: DIC_MASS.uri });
    expect(data.long_name).toBe("dissolved inorganic carbon");
  });

  it("leaves values it did not write when prefill memory is empty", () => {
    // An edit or import: the modal starts with no prefill memory, so stored values
    // are user-owned.
    const stored = { units: "umol kg-1", long_name: "Total DIC", concentration_basis: "per_mass" };
    const { data } = applyCfSelection(stored, DIC_VOLUME, {});

    expect(data.units).toBe("umol kg-1");
    expect(data.long_name).toBe("Total DIC");
    expect(data.concentration_basis).toBe("per_mass");
  });

  it("uses the short label for each CO2 form", () => {
    const labels = Object.fromEntries(
      CF_SHORTLIST_ENTRIES.filter((e) => /carbon_dioxide/.test(e.name)).map((e) => [
        e.name,
        applyCfSelection({}, e, {}).data.long_name,
      ]),
    );

    expect(labels).toMatchObject({
      partial_pressure_of_carbon_dioxide_in_sea_water: "pCO2",
      surface_partial_pressure_of_carbon_dioxide_in_sea_water: "pCO2",
      fugacity_of_carbon_dioxide_in_sea_water: "fCO2",
      mole_fraction_of_carbon_dioxide_in_air: "xCO2",
      mole_fraction_of_carbon_dioxide_in_dry_air: "xCO2",
    });
  });

  it("humanizes the long name for a name with no curated label", () => {
    const generic: CfEntry = {
      name: "mass_concentration_of_chlorophyll_in_sea_water",
      uri: "http://x/CHL/",
      units: "kg m-3",
    };
    const { data } = applyCfSelection({}, generic, {});
    expect(data.long_name).toBe("mass concentration of chlorophyll in sea water");
  });
});

describe("applyCfSelection — clearing", () => {
  it("removes the identifier and its own prefills", () => {
    const first = applyCfSelection({}, PH, {});
    const cleared = applyCfSelection(first.data, null, first.prefilled);

    expect(cleared.data.standard_identifier).toBeUndefined();
    expect(cleared.data.long_name).toBeUndefined();
    expect(cleared.prefilled).toEqual({});
  });

  it("keeps values the user edited", () => {
    const first = applyCfSelection({}, DIC_VOLUME, {});
    const edited = { ...first.data, long_name: "My DIC column" };
    const cleared = applyCfSelection(edited, null, first.prefilled);

    expect(cleared.data.long_name).toBe("My DIC column");
    expect(cleared.data.concentration_basis).toBeUndefined();
  });

  it("keeps everything when there was no prefill memory", () => {
    const stored = {
      standard_identifier: { term: PH.name, uri: PH.uri },
      units: "1",
      long_name: "pH",
    };
    const cleared = applyCfSelection(stored, null, {});

    expect(cleared.data.standard_identifier).toBeUndefined();
    expect(cleared.data.units).toBe("1");
    expect(cleared.data.long_name).toBe("pH");
  });
});

describe("clearCfSelectionOnTypeChange", () => {
  const selected: CfPrefilled = { long_name: "pH" };
  const withPh = {
    standard_identifier: { term: PH.name, uri: PH.uri },
    long_name: "pH",
  };

  it("drops the name and what it prefilled", () => {
    const { data, prefilled } = clearCfSelectionOnTypeChange(withPh, selected);

    expect(data.standard_identifier).toBeUndefined();
    expect(data.long_name).toBeUndefined();
    expect(prefilled).toEqual({});
  });

  it("drops a name chosen from the full table just the same", () => {
    // Shortlist membership is not the test: the name identifies the old quantity
    // either way, and a deliberate off-shortlist pick is no more valid for the new
    // type than a suggested one.
    const offShortlist = {
      standard_identifier: {
        term: "sea_water_ph_abiotic_analogue_reported_on_total_scale",
        uri: "http://vocab.nerc.ac.uk/collection/P07/current/X/",
      },
    };
    expect(clearCfSelectionOnTypeChange(offShortlist, {}).data.standard_identifier).toBeUndefined();
  });

  it("drops a name when moving to a type that has no shortlist", () => {
    // The old asymmetry: sediment has no shortlist to fail, so a pH name used to
    // survive onto a sediment variable.
    const { data } = clearCfSelectionOnTypeChange(withPh, selected);
    expect(data.standard_identifier).toBeUndefined();
  });

  it("keeps user edits while dropping the name", () => {
    const edited = { ...withPh, long_name: "Bottle pH" };
    const { data } = clearCfSelectionOnTypeChange(edited, selected);

    expect(data.standard_identifier).toBeUndefined();
    expect(data.long_name).toBe("Bottle pH");
  });

  it("returns the input untouched when nothing is selected", () => {
    const input = { units: "Pa" };
    expect(clearCfSelectionOnTypeChange(input, {}).data).toBe(input);
  });
});
