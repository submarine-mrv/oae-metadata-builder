# Changelog

Notable changes to the OAE Metadata Builder. Pre-1.0, breaking changes bump the minor version.

## [0.2.0] — Unreleased

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
