# Changelog

Notable changes to the OAE Metadata Builder. Pre-1.0, breaking changes bump the minor version.

## [0.3.0] — 2026-09-08

Built against oae-data-protocol v0.4.0.

- Datasets can record a data access date. Scheduled access requires one; open access needs either
  it or a data access link, and the form says so on both fields rather than marking each required.
  (#75)
- Public comments are a list of entries, each with a link or DOI, a consultation type and an
  optional description, instead of one comma-separated string. An existing value is kept as the
  description of a single entry of type "Other", with its link left blank to fill in. (#75)
- Platform type offers five more NERC L06 vocabulary options. (#75)
- Fixed: `mcdr_forcing_description` was required for every model output dataset, not just
  perturbation runs. (#75)
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
  listed)" is always available and records nothing. (#72)
- The unit field suggests units for the selected standard name — the total pH scale, the
  mol/mmol/umol/ueq set on each denominator for TA and DIC — and still accepts anything you type.
  It no longer fills the unit in for you, since the CF canonical unit is usually not the one people
  report. (#72)
- Drawing a bounding box or line on a map shows the shape as you draw it: two clicks, a drag, or on
  a touch screen a tap or a drag. The box inputs sit in a compass layout, N above, W and E beside,
  S below, and a box whose north edge is below its south edge is flagged and cannot be saved. Boxes
  that cross the antimeridian draw and frame the short way round. The map preview opens on the
  whole globe with no place names. (#73)
- Validation errors inside nested sections, such as a previous or ongoing research entry, now land
  on the field and read "Invalid date format" or "Field is required" rather than showing a raw
  pattern. The compliance checker states that only NetCDF 3 files are supported. (#74)
- Temporal coverage uses the same date picker as the data access date: clicking anywhere in the
  field opens the calendar, malformed text is refused rather than accepted and flagged, and a stored
  date that cannot be read is marked on its own field. (#76)
- Date pickers can be cleared with an X and no longer colour weekends red. (#75)
- Platform type and platform ID descriptions open in a modal instead of a hover tooltip, so the
  vocabulary URLs in them can be copied. (#71)


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
