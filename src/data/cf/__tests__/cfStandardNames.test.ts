import { describe, expect, it } from "vitest";
import {
  getConcentrationBasisFor,
  getLongNameFor,
  getShortlistFor,
  getUnitSuggestions,
  humanizeCfName,
} from "@/components/VariableModal/cfShortlists";
import bundled from "@/schema/schema.bundled.json";
import shortlistConfig from "../cfShortlists.json";
import { CF_SHORTLIST_ENTRIES, loadCfIndex } from "../cfStandardNames";

const P07_PREFIX = "http://vocab.nerc.ac.uk/collection/P07/current/";

/** Every name on a shortlist, field or model. */
const curatedNames = () => [
  ...Object.values(shortlistConfig.shortlists).flat(),
  ...Object.values(shortlistConfig.modelShortlists).flat(),
];

/**
 * Drift guard for the generated artifacts, in the spirit of schemaTypeSync.test.ts:
 * cfShortlists.json is hand-maintained but cfShortlistEntries.json is generated, so
 * a stale committed artifact has to fail here rather than silently show an empty
 * dropdown.
 *
 * The full index is deliberately not loaded in most of these — it is ~476 KB of JSON
 * and parsing it per test file costs more than it proves.
 */
describe("cfShortlistEntries.json", () => {
  it("resolves every curated name", () => {
    const generated = new Set(CF_SHORTLIST_ENTRIES.map((e) => e.name));
    for (const name of curatedNames()) {
      expect(generated, `${name} missing from generated shortlist entries`).toContain(name);
    }
  });

  it("carries the CF canonical units the protocol table specifies", () => {
    const units = Object.fromEntries(CF_SHORTLIST_ENTRIES.map((e) => [e.name, e.units]));
    expect(units).toMatchObject({
      partial_pressure_of_carbon_dioxide_in_sea_water: "Pa",
      mole_concentration_of_dissolved_inorganic_carbon_in_sea_water: "mol m-3",
      moles_of_dissolved_inorganic_carbon_per_unit_mass_in_sea_water: "mol kg-1",
      sea_water_alkalinity_expressed_as_mole_equivalent: "mol m-3",
      sea_water_alkalinity_per_unit_mass_expressed_as_mole_equivalent: "mol kg-1",
      sea_water_ph_reported_on_total_scale: "1",
    });
  });

  it("gives every entry a canonical P07 URI", () => {
    for (const entry of CF_SHORTLIST_ENTRIES) {
      expect(entry.uri).toMatch(new RegExp(`^${P07_PREFIX}[A-Z0-9]+/$`));
    }
  });

  it("has no duplicate names", () => {
    const names = CF_SHORTLIST_ENTRIES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("cfShortlists.json curation", () => {
  it("only annotates names that are on a shortlist", () => {
    const curated = new Set(curatedNames());
    for (const key of ["longNameFor", "concentrationBasis", "unitSuggestions"] as const) {
      for (const name of Object.keys(shortlistConfig[key])) {
        expect(curated, `${key} annotates non-shortlisted ${name}`).toContain(name);
      }
    }
  });

  it("uses concentration_basis values the schema permits", () => {
    const permitted =
      (bundled as { $defs: Record<string, { enum?: string[] }> }).$defs.ConcentrationBasis.enum ??
      [];
    expect(permitted.length).toBeGreaterThan(0);
    for (const basis of Object.values(shortlistConfig.concentrationBasis)) {
      expect(permitted).toContain(basis);
    }
  });

  it("maps model variable types onto field shortlists", () => {
    for (const [modelType, fieldType] of Object.entries(shortlistConfig.modelTypeAliases)) {
      expect(shortlistConfig.shortlists).toHaveProperty(fieldType);
      expect(getShortlistFor(modelType, true)).toEqual(getShortlistFor(fieldType, false));
    }
  });
});

describe("getShortlistFor", () => {
  it("restricts the four curated quantities", () => {
    for (const type of ["pH", "ta", "dic", "co2"]) {
      expect(getShortlistFor(type)?.length, type).toBeGreaterThan(0);
    }
  });

  it("returns null for types that search the full CF list", () => {
    for (const type of ["other", "sediment", "hplc", "physiological", "socioeconomic"]) {
      expect(getShortlistFor(type)).toBeNull();
    }
    expect(getShortlistFor(null)).toBeNull();
    expect(getShortlistFor(undefined)).toBeNull();
  });

  it("gives model-only quantities their own shortlists", () => {
    for (const type of Object.keys(shortlistConfig.modelShortlists)) {
      expect(getShortlistFor(type, true)?.length, type).toBeGreaterThan(0);
      // Model-only types are not field types, so they must not resolve in field mode.
      expect(getShortlistFor(type, false), type).toBeNull();
    }
  });

  it("leaves model types with no curation on the full list", () => {
    for (const type of ["zonal_velocity", "nutrients", "biological_tracers", "other"]) {
      expect(getShortlistFor(type, true), type).toBeNull();
    }
  });

  it("keys on the field vocabulary only when not in model mode", () => {
    // "ph" is a ModelVariableType value; the field vocabulary spells it "pH".
    expect(getShortlistFor("ph", false)).toBeNull();
    expect(getShortlistFor("ph", true)).not.toBeNull();
  });
});

describe("prefill lookups", () => {
  it("gives TA and DIC a concentration basis matching the name", () => {
    expect(getConcentrationBasisFor("sea_water_alkalinity_expressed_as_mole_equivalent")).toBe(
      "per_volume",
    );
    expect(
      getConcentrationBasisFor("moles_of_dissolved_inorganic_carbon_per_unit_mass_in_sea_water"),
    ).toBe("per_mass");
  });

  it("leaves pH and CO2 without a concentration basis", () => {
    expect(getConcentrationBasisFor("sea_water_ph_reported_on_total_scale")).toBeUndefined();
    expect(
      getConcentrationBasisFor("partial_pressure_of_carbon_dioxide_in_sea_water"),
    ).toBeUndefined();
  });

  it("supplies readable long names for curated entries", () => {
    expect(getLongNameFor("partial_pressure_of_carbon_dioxide_in_sea_water")).toBe("pCO2");
    expect(getLongNameFor("sea_water_ph_reported_on_total_scale")).toBe("pH");
  });

  it("falls back to the humanized CF name", () => {
    expect(getLongNameFor("mass_concentration_of_chlorophyll_in_sea_water")).toBeUndefined();
    expect(humanizeCfName("mass_concentration_of_chlorophyll_in_sea_water")).toBe(
      "mass concentration of chlorophyll in sea water",
    );
  });

  it("names each CO2 form by its short label", () => {
    expect(getLongNameFor("partial_pressure_of_carbon_dioxide_in_sea_water")).toBe("pCO2");
    expect(getLongNameFor("surface_partial_pressure_of_carbon_dioxide_in_sea_water")).toBe("pCO2");
    expect(getLongNameFor("fugacity_of_carbon_dioxide_in_sea_water")).toBe("fCO2");
    expect(getLongNameFor("mole_fraction_of_carbon_dioxide_in_air")).toBe("xCO2");
    expect(getLongNameFor("mole_fraction_of_carbon_dioxide_in_dry_air")).toBe("xCO2");
  });
});

describe("getUnitSuggestions", () => {
  const entry = (name: string) => CF_SHORTLIST_ENTRIES.find((e) => e.name === name);

  it("replaces the canonical unit where a name is curated", () => {
    // pH is reported on a named scale, never as CF's dimensionless "1".
    const suggestions = getUnitSuggestions(entry("sea_water_ph_reported_on_total_scale"));
    expect(suggestions).toEqual(["Total Scale"]);
    expect(suggestions).not.toContain("1");
  });

  it("offers every prefix on both volume denominators for TA and DIC", () => {
    for (const name of [
      "sea_water_alkalinity_expressed_as_mole_equivalent",
      "mole_concentration_of_dissolved_inorganic_carbon_in_sea_water",
    ]) {
      const suggestions = getUnitSuggestions(entry(name));
      for (const denominator of ["m-3", "L-1"]) {
        for (const prefix of ["mol", "mmol", "umol", "ueq"]) {
          expect(suggestions, name).toContain(`${prefix} ${denominator}`);
        }
      }
    }
  });

  it("offers every prefix per unit mass for TA and DIC", () => {
    for (const name of [
      "sea_water_alkalinity_per_unit_mass_expressed_as_mole_equivalent",
      "moles_of_dissolved_inorganic_carbon_per_unit_mass_in_sea_water",
    ]) {
      const suggestions = getUnitSuggestions(entry(name));
      expect(suggestions, name).toEqual(["mol kg-1", "mmol kg-1", "umol kg-1", "ueq kg-1"]);
    }
  });

  it("suggests reported salinity units, not CF's 1e-3", () => {
    expect(getUnitSuggestions(entry("sea_water_absolute_salinity"))).toEqual(["g kg-1"]);
    expect(getUnitSuggestions(entry("sea_water_salinity"))).toEqual(["PSU", "1"]);
    expect(getUnitSuggestions(entry("sea_water_practical_salinity"))).toEqual(["PSU", "1"]);
  });

  it("falls back to the canonical unit for an uncurated name", () => {
    const uncurated = { name: "sea_surface_height", uri: "http://x/SSH/", units: "m" };
    expect(getUnitSuggestions(uncurated)).toEqual(["m"]);
  });

  it("dedupes", () => {
    for (const e of CF_SHORTLIST_ENTRIES) {
      const suggestions = getUnitSuggestions(e);
      expect(new Set(suggestions).size, e.name).toBe(suggestions.length);
    }
  });

  it("returns nothing without an entry", () => {
    expect(getUnitSuggestions(null)).toEqual([]);
    expect(getUnitSuggestions(undefined)).toEqual([]);
  });
});

describe("loadCfIndex", () => {
  it("joins the full table and resolves the shortlist within it", async () => {
    const index = await loadCfIndex();
    expect(index.entries.length).toBeGreaterThan(5000);
    expect(index.aliases.length).toBeGreaterThan(0);

    for (const entry of CF_SHORTLIST_ENTRIES) {
      expect(index.byName.get(entry.name)).toEqual(entry);
    }
  });

  it("caches the parsed index", async () => {
    expect(await loadCfIndex()).toBe(await loadCfIndex());
  });
});
