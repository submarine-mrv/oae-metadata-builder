# Experiment Type Multi-Select: Schema Selection Rules

## Background

`experiment_type` is a **multivalued** field on the `Experiment` class — users can
select multiple types to describe a single experiment (e.g., an intervention that
also includes a tracer study selects both "Intervention" and "Tracer Study").

The schema architecture uses class inheritance and mixins to model this:

```
Experiment (base: experiment_type, description, spatial_coverage, ...)
  └─ InSituExperiment (+ vertical_coverage, permits, met data, ...)
       ├─ Intervention (+ InterventionDetails mixin, DosingDetails mixin)
       ├─ Tracer (+ TracerDetails mixin, DosingDetails mixin)
       └─ InterventionWithTracer (is_a: Intervention, + TracerDetails mixin)
  └─ ModelExperiment (+ model_components, grid_details, ...)
```

## Schema Selection Rules

The form renders different schemas (and uiSchemas) depending on which
`experiment_type` values are selected. The rules are:

### 1. Model is exclusive

`model` cannot be combined with any other experiment type. It represents a
fundamentally different kind of experiment (simulation vs. field work) with
non-overlapping fields.

**UI behavior:** When `model` is selected, all other options are disabled. If a
user needs both a model experiment and a field experiment, they should create two
separate experiments.

**Rationale:** ModelExperiment inherits from Experiment (not InSituExperiment) and
has completely different fields (model_components, grid_details, etc.). There is
no combined class in the schema, and the field sets don't overlap in a way that
makes combining them meaningful.

### 2. Intervention and Tracer combine additively

| Selected types | Schema class | Fields rendered |
|---|---|---|
| `intervention` (alone or + base types) | `Intervention` | InSitu + InterventionDetails + DosingDetails |
| `tracer_study` (alone or + base types) | `Tracer` | InSitu + TracerDetails + DosingDetails |
| `intervention` + `tracer_study` (+ any base types) | `InterventionWithTracer` | InSitu + InterventionDetails + TracerDetails + DosingDetails |

### 3. Base types don't affect schema selection

`baseline`, `control`, and `other` are descriptive labels — they all use the
`InSituExperiment` schema. They can be freely combined with each other and with
`intervention` or `tracer_study`.

### Summary decision table

| intervention? | tracer_study? | model? | Schema | uiSchema |
|---|---|---|---|---|
| N | N | N | InSituExperiment | experimentUiSchema |
| Y | N | N | Intervention | interventionUiSchema |
| N | Y | N | Tracer | tracerUiSchema |
| Y | Y | N | InterventionWithTracer | interventionWithTracerUiSchema |
| N | N | Y | ModelExperiment | modelUiSchema |
| * | * | Y | **Invalid** — model is exclusive | (show warning, disable other options) |

## Implementation

### `getExperimentSchemaType(experimentType)`

Shared utility in `src/utils/experimentFields.ts`. Returns one of:
`"intervention"`, `"tracer_study"`, `"intervention_with_tracer"`, `"model"`, or
`"in_situ"` (default).

```typescript
export function getExperimentSchemaType(experimentType: unknown): string {
  const types = Array.isArray(experimentType) ? experimentType : [];

  const hasIntervention = types.includes("intervention");
  const hasTracer = types.includes("tracer_study");
  const hasModel = types.includes("model");

  if (hasModel) return "model";
  if (hasIntervention && hasTracer) return "intervention_with_tracer";
  if (hasIntervention) return "intervention";
  if (hasTracer) return "tracer_study";
  return "in_situ";
}
```

### Model exclusivity enforcement

The form enforces model exclusivity in the `onChange` handler:

- When `model` is added to the selection, all other types are removed.
- When any non-model type is added while `model` is selected, `model` is removed.

This prevents the invalid state from being persisted.

### Files involved

| File | Role |
|---|---|
| `src/utils/experimentFields.ts` | `getExperimentSchemaType()` — shared logic |
| `src/app/experiment/page.tsx` | Schema/uiSchema switching, model exclusivity in onChange |
| `src/utils/validation.ts` | Schema selection for validation |
| `src/contexts/AppStateContext.tsx` | Completion calculation |
| `src/app/overview/page.tsx` | Badge display for selected types |

### See also

- `docs/conditional-fields.md` — how if/then conditional fields work
- `src/utils/schemaViews.ts` — how schemas are extracted from bundled JSON Schema
