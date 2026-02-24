/**
 * Custom ObjectFieldTemplate that enables Mantine's native responsive `cols`.
 *
 * Copied from @rjsf/mantine ObjectFieldTemplate with one change:
 * `gridCols` accepts responsive objects (e.g. `{ base: 1, sm: 2 }`) in addition
 * to plain numbers. A bare number `n` is auto-wrapped to `{ base: 1, sm: n }`
 * so existing `"ui:gridCols": 2` uiSchema entries work unchanged while
 * Mantine generates proper `@media` breakpoints — no CSS `!important` needed.
 */
import { Box, Container, Group, MantineSpacing, SimpleGrid } from "@mantine/core";
import {
  buttonId,
  canExpand,
  descriptionId,
  FormContextType,
  getTemplate,
  getUiOptions,
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
  RJSFSchema,
  StrictRJSFSchema,
  titleId,
} from "@rjsf/utils";

export default function ResponsiveObjectFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: ObjectFieldTemplateProps<T, S, F>) {
  const {
    title,
    description,
    disabled,
    properties,
    optionalDataControl,
    onAddProperty,
    readonly,
    required,
    schema,
    uiSchema,
    fieldPathId,
    formData,
    registry,
  } = props;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const TitleFieldTemplate = getTemplate<"TitleFieldTemplate", T, S, F>("TitleFieldTemplate", registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<"DescriptionFieldTemplate", T, S, F>(
    "DescriptionFieldTemplate",
    registry,
    uiOptions,
  );
  const showOptionalDataControlInTitle = !readonly && !disabled;
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;

  // --- responsive gridCols ---------------------------------------------------
  const rawGridCols = uiOptions?.gridCols;
  const gridCols =
    typeof rawGridCols === "number"
      ? { base: 1, sm: rawGridCols }
      : typeof rawGridCols === "object" && rawGridCols !== null
        ? rawGridCols
        : undefined;
  // ---------------------------------------------------------------------------

  const gridSpacing = uiOptions?.gridSpacing;
  const gridVerticalSpacing = uiOptions?.gridVerticalSpacing;

  return (
    <Container id={fieldPathId.$id} p={0}>
      {title && (
        <TitleFieldTemplate
          id={titleId(fieldPathId)}
          title={title}
          required={required}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
          optionalDataControl={showOptionalDataControlInTitle ? optionalDataControl : undefined}
        />
      )}
      {description && (
        <DescriptionFieldTemplate
          id={descriptionId(fieldPathId)}
          description={description}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
        />
      )}
      <SimpleGrid
        cols={gridCols as any}
        spacing={gridSpacing as MantineSpacing | undefined}
        verticalSpacing={gridVerticalSpacing as MantineSpacing | undefined}
        mb="sm"
      >
        {!showOptionalDataControlInTitle ? optionalDataControl : undefined}
        {properties
          .filter((e) => !e.hidden)
          .map((element: ObjectFieldTemplatePropertyType) => (
            <Box key={element.name}>{element.content}</Box>
          ))}
      </SimpleGrid>
      {canExpand(schema, uiSchema, formData) && (
        <Group mt="xs" justify="flex-end">
          <AddButton
            id={buttonId(fieldPathId, "add")}
            disabled={disabled || readonly}
            onClick={onAddProperty}
            className="rjsf-object-property-expand"
            uiSchema={uiSchema}
            registry={registry}
          />
        </Group>
      )}
    </Container>
  );
}
