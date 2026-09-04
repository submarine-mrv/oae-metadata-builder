# Schema-Driven Architecture & the Parse-Don't-Validate Direction

> Read this before touching the schema pipeline, validation, the variable system, or
> form data flow. It captures *why* the current architecture looks the way it does and
> the direction we're deliberately moving in. Tracked work lives in the `bd` epic
> **`parse-dont-validate`**.

## 1. The bundled schema is the single source of truth

```
LinkML (oae-data-protocol)
  └─ just gen-all ─→ JSON Schema (Draft 2019-09)
       └─ make schema ─→ oae-form/schemas/schema.json   (verbatim copy, git-hash tracked)
            └─ scripts/bundle-schema.mjs ─→ src/schema/schema.bundled.json
                 ├─ AJV validation        (runtime authority)
                 ├─ RJSF rendering         (project / experiment / dataset forms)
                 └─ DraftVariable types    (src/types/variable.ts, kept in sync by tests)
```

`src/schema/schema.bundled.json` is the one artifact that everything downstream reads. Rules:

- **Never hand-duplicate the schema** in TypeScript (no parallel Zod/TypeBox model). LinkML is
  the upstream source of truth; the bundled JSON Schema is the runtime source of truth.
- **Never copy the schema between repos manually** — always `make schema` (checks a clean tree,
  records the protocol git hash as `x-protocol-git-hash`).
- `bundle-schema.mjs` does real schema *surgery* (NVS label decoration, enum-array inlining,
  conditional-field relocation, the `ModelOutputDataset.if` patch). It is the right place to add
  schema transforms that RJSF/AJV need but LinkML doesn't emit — see §5.

## 2. There are two form engines (by design)

| Engine | Renders | Entry points |
|---|---|---|
| **RJSF** (`@rjsf/mantine`) | Project, Experiment, Dataset | `src/app/{project,experiment,dataset}/page.tsx` |
| **Bespoke schema-driven builder** | Variables | `VariableModal.tsx`, `SchemaField.tsx`, `schemaUtils.ts`, `variableModalConfig.ts` |

The bespoke variable engine (~1,500 lines) reimplements `$ref` resolution, `allOf` merging,
required detection, nested get/set, const hydration, enum rendering, and field visibility. It
exists for two reasons:

1. **Curated UX** — the accordion/layer system (`VARIABLE_TYPE_LAYERS`) groups fields into
   meaningful sections and does progressive disclosure (variable type → genesis → sampling).
   RJSF's native `oneOf` rendering can't produce this.
2. **The variable union had no discriminator**, so RJSF/AJV could not cleanly validate or render
   the polymorphic `variables` array. This has since been fixed (see §4).

Reason (1) is a legitimate, lasting choice. Reason (2) no longer applies.

**Do not assume RJSF handles variables.** The dataset RJSF form excludes the `variables` array
from its own validation; `validateDataset` checks it in a single discriminated AJV pass.

The bespoke engine also carries the app's only **vocabulary-backed field** and its only
**runtime-loaded auxiliary data file**: the CF standard name picker on `standard_identifier`, whose
~5,000-name index arrives as a lazy chunk rather than through the bundled schema. Sea names and
platform types work the other way round — those vocabularies are merged *into* the schema at bundle
time by `decorateWithNvsLabels` and rendered by an RJSF widget. See
[`cf-standard-names.md`](cf-standard-names.md) before touching either path.

## 3. Variable polymorphism — what's already correct (don't "fix" it)

Variables are polymorphic, discriminated on **`schema_class`** (LinkML `designates_type: true`,
`variable.yaml`). This modeling is **complete and correct**:

- Each concrete variable class emits `schema_class` as a **required, single-value enum**
  (`DiscretePHVariable.schema_class = { enum: ["DiscretePHVariable"] }`) — i.e. a real
  discriminator tag.
- `FieldDataset.variables.items` is a union of all 18 concrete **field** variable classes. This
  union is produced because the slot's range, `FieldVariable`, is `abstract: true` — **not** by
  `include_range_class_descendants`. (An abstract range has no instantiable base, so LinkML expands
  it to concrete descendants in every generation mode.) `bundle-schema.mjs` rewrites the emitted
  `anyOf` into `oneOf` + `discriminator` — see §4.
- The range is `FieldVariable`, not `Variable`, on purpose. `ModelOutputVariable` descends from `Variable`
  but *not* from `FieldVariable`, so it is excluded from this union and a model variable is invalid
  inside a `FieldDataset`. Ranging over `Variable` would silently admit it. See
  "Model output variables" below.
- Each concrete class already pins its **nested** `analyzing_instrument` / `calibration` to the
  correct subtype, with `additionalProperties: false` at each level:
  - `DiscretePHVariable` → `PHInstrument` → `PHCalibration` (has `dye_type_and_manufacturer`,
    `ph_of_standards`, …)
  - `DiscreteCO2Variable` → `CO2GasDetector` → `DiscreteCO2Calibration` (has `standard_gas_info`)
  - `DiscreteMeasuredVariable` → base `AnalyzingInstrument` → base `Calibration` (generic only)

**This is intentional.** Generic variables get base instrument/calibration; typed variables get
their specific ones. The type-specific fields *are* valid against their `schema_class`. Do not try
to "expand" or "complete" the nested polymorphism.

Corollary: `oae_data_protocol.validation.schema.json` (generated with
`include_range_class_descendants=True`) is intentionally **not** used in oae-form. For these nested
slots it is *looser* than the form schema (it turns `analyzing_instrument` into an `anyOf` of all
instrument subtypes). It exists for other programmatic-validation use cases, not the builder.

### Model output variables

`ModelOutputDataset.variables` ranges over the single concrete class `ModelOutputVariable` — no union, no
discriminator needed. A model variable is produced by the simulation, so it carries none of the
sampling, instrument, calibration or in-situ QC metadata a field variable does; it has only
`variable_type`, `long_name`, `dataset_variable_name`, `units` and an optional
`standard_identifier`. That last one is a `VocabularyItemReference` (`term` + `uri` both required,
`description` optional) and is where a CF standard name is recorded — the picker treats the four
model types that mirror field quantities as shortlisted and searches the full CF table for the
rest.

The two families are disjoint in both directions:

| | field dataset | model dataset |
|---|---|---|
| slot range | `FieldVariable` (abstract, 18 concrete) | `ModelOutputVariable` (1 concrete) |
| `variable_type` vocabulary | `VariableType` (`pH`, `ta`, `dic`, …) | `ModelVariableType` (`air_sea_co2_flux`, `ph`, `zonal_velocity`, …) |

Because the vocabularies share almost no values, switching a dataset's `dataset_type` cannot just
re-stamp `schema_class` — it has to translate `variable_type` too. `parseDataset` does this in both
directions (`coerceToModelVariables` / `coerceOutOfModelVariables` in `parseEntity.ts`), mapping the
four overlapping quantities (pH, TA, DIC, CO₂) and falling back to `other`. `schema_class` remains
the source of truth: a concrete field class pins `variable_type` even when a stored value disagrees.

In the UI, `VariablesField` / `VariableModal` switch to model mode via
`ui:options.modelOutput: true` in `modelOutputUiSchema.ts`. Model mode swaps the type dropdown to
`MODEL_VARIABLE_TYPE_OPTIONS` and hides the genesis and sampling selects — `ModelOutputVariable` has
neither. The accordion still uses the shared `BASE` layer; the sections that do not apply empty
themselves out through the normal `fieldExistsInSchema()` filter rather than being special-cased.

## 4. The union is discriminated

LinkML emits `variables.items` as a bare `anyOf[18]` with no discriminator. AJV would then try
every branch and, on failure, emit a wall of merged errors — which is why a hand-rolled
`datasetValidation.ts` router used to exist.

`bundle-schema.mjs` now rewrites that union to `oneOf[18]` +
`discriminator: { propertyName: "schema_class" }`, and AJV runs with `discriminator: true`
(`validation.ts`). AJV routes each variable to the one branch its `schema_class` names, so errors
are targeted and `datasetValidation.ts` is gone — `validateDataset` does it in a single pass.

## 5. The direction: parse, don't validate

The codebase used to *validate* the same loose data repeatedly — `Record<string, unknown>` / `any`
everywhere, and variables stripped on save **and** import **and** validate — never narrowing the
type. The target is to **parse once at each boundary** into a trusted value, then stop re-checking.
The variable path now works this way; `cleanFormData` is still called at ~13 sites elsewhere.

Boundaries are few: **import** (file→state), **RJSF/modal onChange** (form→state),
**restore** (session→state) inbound; **export** (state→file) outbound.

### Phased plan

- **Phase 0 — Safety net.** ✅ Done. fast-check property tests for the invariants we keep breaking:
  export→import round-trip is identity; no field outside a variable's `schema_class` survives a
  save/import (`variableInvariants.property.test.ts`).
- **Phase 1 — Schema keystone.** ✅ Done. `bundle-schema.mjs` transforms `variables.items` from
  `anyOf[18]` → `oneOf[18] + discriminator`; AJV runs with `discriminator: true`.
- **Phase 2 — Parse boundary.** ✅ Done. `parseVariable` / `parseEntity` run normalize → strip →
  clean **once** at each write boundary (modal save, import, restore); dataset validation is a
  single AJV pass against the discriminated schema; `datasetValidation.ts` is deleted.
  `stripExtraVariableFields` survives only as **write-time type-switch cleanup**, not a validation
  crutch.
- **Phase 2b — Types.** Superseded — see §6. The `DraftVariable` union is hand-maintained rather
  than generated.
- **Phase 3 — Propagate the pattern (additive).** Partly done: the `validationStatus` side-table is
  gone (status is derived). Still open: `Form<T>` on the pages, branded ID types, revisit
  `omitExtraData: true`.

## 6. TypeScript types: hand-maintained, synced by tests

`src/types/variable.ts` declares `DraftVariable` as a hand-written union of the 19 concrete
variable classes (18 field classes + `ModelOutputVariable`). It is **not** generated. Drift is
caught by tests rather than by a build step: `variablesDiscriminator.test.ts` reads the branch
names out of the bundled schema's discriminated union, and `schemaTypeSync.test.ts` compares class
properties — so a schema change that adds or renames a class fails the suite.

If this is ever replaced with generation, use **`json-schema-to-typescript` on the bundled schema**,
not LinkML `gen-typescript`:

1. The bundled schema is the runtime truth (post-decoration, post-discriminator); generating from
   it keeps types in lockstep with what AJV and RJSF actually see.
2. The single-value `schema_class` enums compile to **string literals**, and `oneOf` compiles to a
   union — so you get a real discriminated union (`switch (v.schema_class)` with exhaustiveness)
   for free. `gen-typescript` emits `schema_class: string` and loses the discriminant.
3. No second toolchain — we already produce and bundle the JSON Schema.

Generated types are **compile-time only**. `pattern`, `minimum`/`maximum`, and LinkML `rules:` live
in AJV at runtime, not in the types. That division of labor is intentional: JSON Schema + AJV is the
"type system" for data correctness; TypeScript is the "type system" for code structure.

## 7. What does NOT need to change

- **No `oae-data-protocol` changes** are required for this direction. The polymorphism, the
  `schema_class` discriminator tags, and the nested instrument/calibration typing are all already
  correct.
- **No new validation library** (Zod/TypeBox/Effect-TS). The lightweight parse patterns
  (`Result`, smart constructors, discriminated-union errors — "Effect without Effect-TS") cover the
  need. Effect-TS stays on the watch list for if/when a real async pipeline (server validation,
  multi-step import) appears.
- **No language switch.** RJSF + the bundled schema do enormous work that would have to be rebuilt
  in any alternative ecosystem.
