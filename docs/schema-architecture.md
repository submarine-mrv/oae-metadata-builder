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
            └─ scripts/bundle-schema.mjs ─→ public/schema.bundled.json
                 ├─ AJV validation        (runtime authority)
                 ├─ RJSF rendering         (project / experiment / dataset forms)
                 └─ (planned) generated TS types
```

`public/schema.bundled.json` is the one artifact that everything downstream reads. Rules:

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
2. **The variable union has no discriminator** (see §4), so RJSF/AJV can't cleanly validate or
   render the polymorphic `variables` array.

Reason (1) is a legitimate, lasting choice. Reason (2) is the part we're fixing.

**Do not assume RJSF handles variables.** The dataset RJSF form excludes the `variables` array
from its own validation and routes it through `datasetValidation.ts`.

## 3. Variable polymorphism — what's already correct (don't "fix" it)

Variables are polymorphic, discriminated on **`schema_class`** (LinkML `designates_type: true`,
`variable.yaml`). This modeling is **complete and correct**:

- Each concrete variable class emits `schema_class` as a **required, single-value enum**
  (`DiscretePHVariable.schema_class = { enum: ["DiscretePHVariable"] }`) — i.e. a real
  discriminator tag.
- `FieldDataset.variables.items` is an `anyOf` of all 18 concrete variable classes. This union is
  produced because `Variable` is `abstract: true` — **not** by `include_range_class_descendants`.
  (An abstract range has no instantiable base, so LinkML expands it to concrete descendants in
  every generation mode.)
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

## 4. The one real gap: the union has no discriminator

`variables.items` is a bare `anyOf[18]` with no AJV `discriminator` and no `if/then` on
`schema_class`. AJV therefore tries every branch and, on failure, emits a wall of merged errors.
That is the entire reason `datasetValidation.ts` exists — it hand-routes each variable to its
`schema_class` subschema to get clean, targeted errors.

`datasetValidation.ts` is a **temporary workaround** (bd `oae-form-99i`). It is slated for deletion.

## 5. The direction: parse, don't validate

The codebase currently *validates* the same loose data repeatedly (`Record<string, unknown>` /
`any` everywhere; `cleanFormData` at 7+ sites; variables stripped on save **and** import **and**
validate) and never narrows the type. The target is to **parse once at each boundary** into a
trusted value, then stop re-checking.

Boundaries are few: **import** (file→state), **RJSF/modal onChange** (form→state),
**restore** (session→state) inbound; **export** (state→file) outbound.

### Phased plan (smallest delta / most foundational first)

- **Phase 0 — Safety net.** fast-check property tests for the invariants we keep breaking:
  export→import round-trip is identity; no field outside a variable's `schema_class` survives a
  save/import.
- **Phase 1 — Schema keystone (one bundler function).** Transform `variables.items` from
  `anyOf[18]` → `oneOf[18] + discriminator: { propertyName: "schema_class" }` in
  `bundle-schema.mjs`; enable `discriminator: true` in the AJV config. Safe and isolated — current
  code ignores the discriminator until Phase 2 flips over.
- **Phase 2 — Parse boundary (deletes `datasetValidation.ts`).** Add `Result<T,E>` and
  `parseVariable(unknown): Result<Variable, …>` that runs normalize → strip → clean **once** at the
  write boundary. Switch dataset validation to a single AJV pass against the discriminated schema;
  delete `datasetValidation.ts`. `stripExtraVariableFields` survives only as **write-time
  type-switch cleanup**, not a validation crutch.
- **Phase 2b — Generated types.** Add `json-schema-to-typescript` over the bundled schema to give
  `parseVariable` a real discriminated-union `Variable` return type. (See §6.)
- **Phase 3 — Propagate the pattern (additive).** Type `Form<T>` on the pages; replace the
  `validationStatus` side-table with a `Validated<T>` type; branded ID types; revisit
  `omitExtraData: true`.

The discriminator (Phase 1) makes inline validation correct and clean-errored; `parseVariable`
(Phase 2) guarantees stored variables are always validatable. **Neither deletes
`datasetValidation.ts` alone — they compose.**

## 6. TypeScript types: from JSON Schema, not from LinkML

When we add generated types, use **`json-schema-to-typescript` on the bundled schema**, not LinkML
`gen-typescript`:

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
