/**
 * CustomFieldTemplate - For object fields that have a `ui:style` border
 * (e.g. `nestedItemStyle` on `data_submitter`, `platform_info`), turn the
 * border red when the field has `rawErrors`. For all other fields, falls
 * through to the same behavior as the default `@rjsf/mantine` FieldTemplate.
 *
 * Why this exists:
 *
 * When a required object is absent from form data, AJV emits a single
 * "required" error against the parent. RJSF's SchemaField extracts that
 * error and passes it as `rawErrors` to the FieldTemplate. We want to
 * surface this visually as "the whole section is incomplete" — most
 * naturally by turning the section's existing border red.
 *
 * Architectural note:
 * - `ArrayFieldTemplate` IS the visual wrapper that draws its own Fieldset
 *   border, so making it red is straightforward (one element, one border).
 * - `ObjectFieldTemplate` does NOT draw a border — the border on
 *   `data_submitter` etc. comes from `ui:style: nestedItemStyle` applied
 *   at the FieldTemplate level via the `style` prop. AND `@rjsf/core`'s
 *   `ObjectField` doesn't forward `rawErrors` to its template anyway.
 * - So the cleanest place to handle this is FieldTemplate: read
 *   `rawErrors`, and if it's an object field with an existing `style`,
 *   override the `border` shorthand in that same style.
 *
 * Why the `border` shorthand and not `borderColor`:
 * - We tried `{ ...style, borderColor: red }` first. It looks correct
 *   while the error is showing, but when the error clears, the border
 *   turns BLACK instead of returning to gray. React diffs each style key
 *   individually, so removing `borderColor` calls `el.style.borderColor =
 *   ""`. The browser does NOT re-derive `border-color` from the earlier
 *   `border` shorthand — it falls back to the CSS initial value
 *   (`currentColor`, often black). The shorthand and longhand live as
 *   independent declarations on the inline style.
 * - We also tried routing the color through a CSS custom property
 *   declared inside `nestedItemStyle`. That works for the immediate
 *   element but CSS custom properties INHERIT through the DOM tree, so
 *   any nested object also using `nestedItemStyle` (e.g. an inner
 *   `affiliation` Organization) would inherit the red color even though
 *   it has no errors. Inheritance contamination footgun — rejected.
 * - The shorthand override avoids both problems: React diffs `border` as
 *   one key, the next render's shorthand reassignment cleanly sets all
 *   border longhands together (including the original gray color), and
 *   only the element it's set on is affected.
 */
import { Box } from "@mantine/core";
import {
  FieldTemplateProps,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  getTemplate,
  getUiOptions,
} from "@rjsf/utils";
import {
  NESTED_ITEM_BORDER_STYLE,
  NESTED_ITEM_BORDER_WIDTH,
} from "@/app/uiSchemaConstants";

function isObjectSchema(schema: any): boolean {
  if (!schema) return false;
  if (Array.isArray(schema.type)) {
    return schema.type.includes("object");
  }
  return schema.type === "object" || (!schema.type && !!schema.properties);
}

export default function CustomFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: FieldTemplateProps<T, S, F>) {
  const {
    id,
    classNames,
    style,
    label,
    errors,
    help,
    displayLabel,
    description,
    rawDescription,
    hidden,
    schema,
    uiSchema,
    registry,
    children,
    rawErrors,
    fieldPathId: _fieldPathId, // Added in RJSF 6.4 — destructure to keep out of ...otherProps DOM spread
    ...otherProps
  } = props;

  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const WrapIfAdditionalTemplate = getTemplate<"WrapIfAdditionalTemplate", T, S, F>(
    "WrapIfAdditionalTemplate",
    registry,
    uiOptions,
  );

  if (hidden) {
    return <Box display="none">{children}</Box>;
  }

  // For object fields with rawErrors, replace the existing `border`
  // shorthand from `ui:style` with a red one. We override the full
  // shorthand (not just borderColor) so React's style diff cleanly
  // restores the original border when the error clears — see the
  // architectural note at the top of the file.
  // For object fields without an existing border, this is a no-op — those
  // fields rely on the inner inputs and the standard error text.
  const objectHasErrors =
    isObjectSchema(schema) && rawErrors && rawErrors.length > 0;
  const styleWithErrorBorder =
    objectHasErrors && style
      ? {
          ...style,
          border: `${NESTED_ITEM_BORDER_WIDTH} ${NESTED_ITEM_BORDER_STYLE} var(--mantine-color-red-5)`,
        }
      : style;

  return (
    <WrapIfAdditionalTemplate
      id={id}
      classNames={classNames}
      style={styleWithErrorBorder}
      label={label}
      displayLabel={displayLabel}
      rawDescription={rawDescription}
      schema={schema}
      uiSchema={uiSchema}
      registry={registry}
      rawErrors={rawErrors}
      {...otherProps}
    >
      {children}
      {errors}
      {help}
    </WrapIfAdditionalTemplate>
  );
}
