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
- **ModelOutputDataset** — root if/then on simulation_type

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
