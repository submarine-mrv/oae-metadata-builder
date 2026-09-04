# CF Standard Names

The variable modal lets an author attach a CF standard name to a variable. That name and its
NERC NVS P07 URI become the variable's `standard_identifier`, and the CF canonical unit seeds
`units`.

CF names are **not validated at the schema level**, deliberately. `standard_identifier` stays a
generic `VocabularyItemReference` in LinkML, so a document that names a term outside CF is still
valid. This is a UI affordance, not a constraint. Pinning names per variable class in the protocol
is a possible later step; nothing here assumes it.

## Where the data comes from

Two sources, joined at build time:

| Source | What it gives |
|---|---|
| `vocab.nerc.ac.uk/collection/P07/current/?_profile=dd` | `{uri, prefLabel}` per concept. `prefLabel` **is** the CF standard name. |
| `cfconventions.org/.../cf-standard-name-table.xml` | `canonical_units` per entry, plus the alias table. |

Neither alone is enough: P07 has the stable URIs but no units, and the CF table has units but no
URIs.

**The join is an inner join, and that is also the filter.** P07 carries ~600 deprecated concepts
that the CF table has already dropped. Matching on `P07.prefLabel === CF entry id` keeps only names
that are current in both. Widening it to a left join would resurrect every deprecated term. At CF
v94 the join is 5,071 names with nothing on the CF side left unmatched.

Definitions are **not** carried. CF definitions average ~660 characters and would add ~300 KB
gzipped for text that is one click away on NVS. `standard_identifier.description` is left for the
author to write.

## Refreshing after a CF release

```bash
make cf-vocab           # fetch if missing, then join
make cf-vocab-refresh   # re-fetch both sources first
```

Raw fetches land in `schemas/cf/` and are gitignored — 5.3 MB is not worth versioning. This differs
from `schemas/nvs/*.json`, which are committed because they are ~12 KB.

`scripts/build-cf-standard-names.mjs` writes two files under `src/data/cf/`, both **committed**:
CI runs `npm run build` and never `make`, the same contract as `src/schema/schema.bundled.json`.

| File | Content | Size |
|---|---|---|
| `cfStandardNames.index.json` | `[name, p07Id, units]` tuples + aliases + meta | 476 KB / 73 KB gz |
| `cfShortlistEntries.json` | resolved entries for the curated names | ~2 KB |

The script throws rather than warning when the join degrades: under 5,000 names, under 99% of the
CF table matched, a P07 URI outside the expected prefix, or a curated name that no longer exists.
`src/data/cf/__tests__/cfStandardNames.test.ts` catches the other direction — a committed artifact
that has gone stale relative to `cfShortlists.json`.

## Delivery

`src/data/cf/cfStandardNames.ts` is the **only** module allowed to import
`cfStandardNames.index.json`, and it does so through a dynamic `import()` so Vite emits it as its
own chunk. A static import anywhere else would pull 73 KB gz into the initial bundle. The shortlist
file is imported eagerly because it is ~2 KB.

The effect: a pH/TA/DIC/CO₂ author never loads the index at all. It arrives only when a variable
type with no shortlist opens the picker.

## Curation

`src/data/cf/cfShortlists.json` is hand-maintained. It is JSON rather than TypeScript because the
Node build script reads it to resolve entries and to fail when a curated name disappears.

Shortlists come in two groups:

- `shortlists` keys on field `VariableType`: `pH`, `ta`, `dic`, `co2`.
- `modelShortlists` keys on `ModelVariableType` for quantities the field vocabulary has no
  equivalent for: `air_sea_co2_flux`, `salinity`, `temperature`.
- `modelTypeAliases` maps the four `ModelVariableType` values that *do* name the same quantity as a
  field type (`ph`, `total_alkalinity`, `dissolved_inorganic_carbon`, `co2`) onto the field list, so
  the curation is written once.

A shortlist is the default view, not a hard lock: the dropdown shows it under a "Suggested for X"
heading, with a **Search all standard names** row that switches to the full table and a **Back to
suggested names** row that returns. Everything else searches the full table from the start.

That switcher lives in `Combobox.Footer` rather than in the option list, because the footer does not
scroll — in full-list mode the equivalent option would sit at position 101, past the fold. It is a
full-width, left-aligned `Button variant="subtle"` so it reads as another row of the list rather
than a pill floating beneath it.

Search-all is a per-visit detour: closing the dropdown resets it, so the picker always reopens on
the suggestions. A name chosen from the full table is **not** added to the suggested list — the
trigger shows it, and "Search all standard names" is how to get back to the list it came from. That
does mean the shortlist can be showing while the selection is not in it, which is why a stored term
the shortlist does not cover still loads the index: without it there is no way to tell a valid CF
name that simply is not suggested for this type from one that has been retired, and the picker
would wrongly flag the first as the second.

Two options exist beyond the vocabulary itself:

The input carries a clear button when something is selected, the same `CloseButton` Mantine's
`Select` renders for `clearable` — every other select in the app is clearable and this one should
not be the exception. `Combobox` has no `clearable` prop, so the right section is built by hand:
`rightSectionPointerEvents` is `"all"` only while the clear button is showing, otherwise clicks fall
through to the trigger and open the dropdown. The button sits beside the trigger rather than inside
it, so its click cannot bubble into the toggle.

Clearing and "Other" write the same thing — nothing — but they are not the same gesture. The X means
"no answer"; "Other" means "I looked, there isn't one", and the trigger says so.

- **"Other (no standard name listed)"** is always offered, below a divider. It writes nothing — it
  clears `standard_identifier` and rolls back the prefills, exactly like clearing. It exists so
  someone filling in every field has something to pick. The choice is session-only: reopening the
  variable shows the placeholder again, because there is nothing stored to show.

  It renders in normal body text, not dimmed. It is a value ("none"), not a disabled row, and the
  sans face already sets it apart from the monospace CF names.

The file also carries what a selection prefills:

- `longNameFor` — a readable `long_name` (`pCO2`, not `partial pressure of carbon dioxide in sea
  water`). Names without an entry fall back to the CF name with underscores replaced by spaces.
- `concentrationBasis` — **load-bearing.** TA and DIC each have a per-volume and a per-mass CF
  name, and `concentration_basis` is a required enum on both. Without this the two can disagree.
  `ModelOutputVariable` has no such field, so the modal passes `hasConcentrationBasis: false` and
  the prefill is skipped rather than written and stripped again.
- `unitSuggestions` — what the unit dropdown offers. **These replace the CF canonical unit rather
  than extending it**, because the reported unit frequently is not the canonical one: pH is given on
  a named scale, never CF's dimensionless `1`, and salinity as PSU rather than `1e-3`. A name with
  no entry falls back to its canonical unit.

## Prefill rules

`src/components/VariableModal/cfPrefill.ts` holds the logic as pure functions; `VariableModal`
holds one `cfPrefillRef` per open modal.

Selecting a name writes `standard_identifier` **whole** — never subfield by subfield.
`VocabularyItemReference` requires both `term` and `uri`, so a half-built object would fail export
validation.

It then prefills `long_name` and `concentration_basis`, but only where the field is empty or still
holds what this picker last put there. Anything the author typed survives. Clearing the name rolls
back the same way.

Two fields are deliberately never prefilled:

- **`units`.** The CF canonical unit is often not what gets reported, so the unit field offers it as
  a suggestion instead of filling it in. Writing it would mean an author who reports µmol kg⁻¹ has
  to notice and correct a wrong value rather than simply enter theirs.
- **`dataset_variable_name`.** It names a column in the author's own data file.

The ref is empty when the modal opens, including when editing a stored variable, so nothing the
picker does can overwrite imported values.

Two rules that are easy to break:

- **Never write `cfPrefillRef` inside a `setFormData` updater.** React may invoke an updater more
  than once (StrictMode does, in dev), which applies the ref write twice and loses the rollback.
  Both handlers compute from the current `formData` and call `setFormData` with a plain value.
- **Never stash UI state inside `standard_identifier`.** `VocabularyItemReference` is
  `additionalProperties: false`; AJV rejects extra keys on export.

## Units

`UnitsField` is a Mantine `Autocomplete`, not a `Select` and not the `EnumWithOtherField` pattern.
`Autocomplete` keeps `value` as the raw string and never coerces it to a member of `data`, so a
typed unit lands in `units` directly. There is no `units_custom` sibling, by design — see
[`conditional-fields.md`](conditional-fields.md) for where that pattern *is* used.

The field starts empty and stays empty until the author types. Suggestions come from
`unitSuggestions` for the selected CF name, falling back to that name's canonical unit. With no CF
name selected the field falls back to the per-variable-type placeholder from
`VARIABLE_SCHEMA_MAP.placeholderOverrides`.

## Search

The picker caps rendering at 100 options and reports the true match count in a footer.

The spinner on the trigger is **derived** (`isFullList && !index`), never held as state. As state it
could stick on forever: `setIndex` re-renders, which fires the loading effect's cleanup, and a
separate `.finally` microtask meaning to clear the flag then finds the effect torn down and skips
the write. Whether React batched those two microtasks decided whether it happened, which made it
look intermittent. Matching
normalises underscores to spaces and requires every query word to appear somewhere in the name, so
"partial pressure carbon dioxide" finds
`partial_pressure_of_carbon_dioxide_in_sea_water` — CF names are full of connecting words nobody
types. Ranking is exact, then prefix, then word-boundary, then substring, then words-present.

CF aliases (retired names that still resolve) are searched too, and render as
`alias → current_name`. A direct name match always outranks an alias pointing at it.

The trigger always renders the stored term directly, whether or not the index has resolved it, so a
saved value never blinks out to the placeholder while the chunk loads. A term the current table does
not contain — an imported document, or a name deprecated since the last refresh — keeps a note
beneath it, added only once the index has loaded and come up empty.
