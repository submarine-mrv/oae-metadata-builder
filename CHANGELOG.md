# Changelog

Notable changes to the OAE Metadata Builder. Pre-1.0, breaking changes bump the minor version.

## [Unreleased]

Built against oae-data-protocol v0.3.0.

- Dropdown fields now show the description tooltip that text fields already had. No dropdown on the
  project, experiment or dataset forms had one before. (#69)
- Sediment variables no longer carry `sediment_sampling_method`, and QC researcher is a plain name
  instead of a person record with contact details. Metadata saved with either needs that field
  re-entered. (#69)
- Platform type now points at the NERC L06 vocabulary, and dataset type links to the SeaBASS
  definitions list. (#69)
- Variables can now carry a CF standard name. pH, TA, DIC, CO₂ and the model-output quantities
  (air-sea CO₂ flux, salinity, temperature) open on a short suggested list, with a button to search
  all 5,071 current CF names and one to go back. Selecting a name records it and its NERC NVS P07
  URI in `standard_identifier`, and fills in the full name and — for TA and DIC — the
  per-volume/per-mass basis, leaving anything you have already typed alone. "Other (no standard name
  listed)" is always available and records nothing.
- The unit field suggests units for the selected standard name — pH scales, the mol/mmol/umol/ueq
  set on each denominator for TA and DIC — and still accepts anything you type. It no longer fills
  the unit in for you, since the CF canonical unit is usually not the one people report.


## [0.2.0] — 2026-08-12

Built against oae-data-protocol v0.2.0 (`33424d83`).

- Model output datasets describe each variable individually — type, name, units and an
  optional standard identifier — instead of a fixed checklist of variable names. Datasets saved
  before this change lose the old checklist when loaded and need their variables re-added from the
  dataset page. (#60)
- Added compliance checker MVP that validates a data file against the protocol templates (/checker). (#30)
- Research project and experiment name are now required fields. (#61)
- Long free-text input fields grow with their content instead of staying a single line. (#55)
- Added Google Analytics 4 tracking. (#62)

## [0.1.0] — 2026-07-24

Built against oae-data-protocol `e48c48b9` — untagged, 6 commits after protocol v0.1.0. The bundled
schema still declared `version: 0.1.0`, so the commit is the accurate reference.

First tagged release (43 PRs since 2025-09-09).

- Schema-driven project, experiment and dataset forms generated from the OAE Data Protocol.
- Variable builder covering pH, TA, DIC, CO₂, sediment, HPLC, physiological and socioeconomic
  types, across discrete, continuous and calculated variants.
- Model output datasets, mCDR dosing, and spatial/temporal coverage with map input.
- Session save and restore, JSON import/export, and per-entity validation status.
- Migrated from Next.js to Vite + TanStack Router; Biome for linting and formatting.
