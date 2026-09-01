# Conditional Fields

How "show field X when field Y = Z" works, and why it touches so many files.

## Background

We want fields like `alkalinity_feedstock_custom` to only appear when the user picks "other" from a dropdown. Standard JSON Schema `if/then` handles this fine — but RJSF has opinions.

LinkML generates the conditional field in **both** root `properties` (with the full definition) and the `then` block (as an empty `{}`). RJSF doesn't care about the `then` — it sees the field in `properties` and renders it unconditionally. So the conditional is never actually conditional.

## How we work around it

There are three layers involved. Each one compensates for a different RJSF quirk.

### 1. Bundler moves field defs into `then`

`scripts/bundle-schema.mjs` — `fixConditionalFields()`

We delete the field from root `properties` and copy the full definition into the `then` block (replacing the empty `{}`). Now the field *only* exists inside the `if/then`, so RJSF can't render it unconditionally.

At this point the `$defs` still have `additionalProperties: false` from LinkML.

### 2. Schema views flip `additionalProperties` to `true`

`src/utils/schemaViews.ts` — `createSchemaView()`

Here's the annoying part: RJSF won't evaluate `if/then` at all when `additionalProperties: false`. The conditional fields just silently don't render. So when we promote a `$def` to a root-level form schema, we override `additionalProperties: true` for the ones that need conditionals.

Currently that's:
- **Intervention** — allOf with if/then for feedstock, feedstock_processing, feedstock_type
- **InterventionWithTracer** — same conditionals
- **ModelComponent** — root if/then on model_component_type
- **ModelOutputDataset** — allOf with if/then on simulation_type, plus the two data-access rules
  inherited from Dataset

### 3. onChange cleanup catches orphaned data

`src/utils/conditionalFields.ts` — `cleanupConditionalFields()`

The `additionalProperties: true` override has a side effect. If a user picks "other", types something in the custom field, then switches back to a non-"other" value, RJSF holds onto the orphaned data and renders it as a raw key/value editor. Ugly.

`cleanupConditionalFields()` runs in `onChange` — it checks each trigger field and deletes the custom field's data when the trigger condition no longer holds. Form pages wire this up by passing their `ConditionalFieldPair[]` config.

## Why not just `additionalProperties: false`?

We tried. RJSF skips `if/then` evaluation entirely when `additionalProperties: false`. The JSON Schema validates correctly either way — this is purely an RJSF rendering limitation. If they fix it upstream, we could drop layers 2 and 3.

## Adding a new conditional field

1. **LinkML** (`oae-data-protocol`): add the `if/then` rule in schema YAML
2. **Bundler** (`scripts/bundle-schema.mjs`): add the field name to `conditionalFields` in `fixConditionalFields()`
3. **Cleanup** (`src/utils/conditionalFields.ts`): add a `ConditionalFieldPair`
4. **Form page**: make sure `onChange` calls `cleanupConditionalFields()` with the updated config
5. **Schema view** (`src/utils/schemaViews.ts`): if it's a new class, pass `hasConditionalFields: true` in `createSchemaView()`

## Rules that don't relocate a field

`Dataset` carries two data-access rules: scheduled access requires `data_access_date`, and open
access requires either `data_access_date` or `data_access_link`. Neither field is in
`conditionalFields`, and neither should be — `data_access_date` stays in root `properties` and is
always rendered.

`fixConditionalFields()` cannot relocate it anyway. It writes the definition into
`allOf[].then.properties[field]`, but the open-access rule nests its `properties` a level deeper
inside `anyOf`, which the function does not walk. Adding the field to the list would make it render
under scheduled access and vanish under open access — the case that needs it most.

The open-access rule is enforced by AJV and presented by `errorTransformer.ts`, which collapses the
four raw AJV errors (one per anyOf branch, plus a bare `anyOf` and `if`) into one message attached
to both fields.

## Watch the rule count

LinkML emits a bare root-level `if`/`then` for a single rule and wraps in `allOf` at two or more.
Rules inherited from a parent class change that count, so a class can move between the two shapes
without anyone touching it. `fixConditionalFields()` handles both. The `ModelOutputDataset`
`simulation_type` patch in `bundle-schema.mjs` originally only handled the root shape and silently
stopped applying when `Dataset` gained rules, which made `mcdr_forcing_description` required for
every model dataset. It now searches both shapes and throws if it fails to find exactly one match.
