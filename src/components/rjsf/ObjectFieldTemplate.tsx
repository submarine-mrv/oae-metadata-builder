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
  StrictRJSFSchema
} from "@rjsf/utils";
import FieldLabel from "./FieldLabel";

/**
 * Custom ObjectFieldTemplate that renders title with info icon OUTSIDE
 * the styled box (for array items with nestedItemStyle)
 */
export default function CustomObjectFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: ObjectFieldTemplateProps<T, S, F>) {
  const {
    title,
    description,
    disabled,
    properties,
    onAddClick,
    readonly,
    required,
    schema,
    uiSchema,
    idSchema,
    formData,
    registry
  } = props;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const DescriptionFieldTemplate = getTemplate<
    "DescriptionFieldTemplate",
    T,
    S,
    F
  >("DescriptionFieldTemplate", registry, uiOptions);

  // Button templates are not overridden in the uiSchema
  const {
    ButtonTemplates: { AddButton }
  } = registry.templates;
  const gridCols =
    (typeof uiOptions?.gridCols === "number" && uiOptions?.gridCols) ||
    undefined;
  const gridSpacing = uiOptions?.gridSpacing;
  const gridVerticalSpacing = uiOptions?.gridVerticalSpacing;

  // Check if this is an array item (will have ui:style for the box)
  const hasNestedStyle = uiOptions?.style;
  const useModal = uiOptions?.descriptionModal === true;

  // Get description as string (schema.description is string, description prop can be ReactElement)
  const descriptionText = typeof description === "string"
    ? description
    : schema?.description;

  return (
    <Container id={idSchema.$id} p={0}>
      {/* Render title OUTSIDE the styled box */}
      {title && hasNestedStyle && (
        <FieldLabel
          label={title}
          description={descriptionText}
          required={required}
          useModal={useModal}
          order={4}
          fw={500}
        />
      )}

      {/* Styled box with properties */}
      <Box style={hasNestedStyle ? uiOptions.style : undefined}>
        {/* For non-array items, render title inside as before */}
        {title && !hasNestedStyle && (
          <FieldLabel
            label={title}
            description={descriptionText}
            required={required}
            useModal={useModal}
            order={4}
            fw={500}
          />
        )}

        {description && (
          <DescriptionFieldTemplate
            id={descriptionId<T>(idSchema)}
            description={description}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />
        )}

        <SimpleGrid
          cols={gridCols}
          spacing={gridSpacing as MantineSpacing | undefined}
          verticalSpacing={gridVerticalSpacing as MantineSpacing | undefined}
          mb="sm"
        >
          {properties
            .filter((e) => !e.hidden)
            .map((element: ObjectFieldTemplatePropertyType) => (
              <Box key={element.name}>{element.content}</Box>
            ))}
        </SimpleGrid>

        {canExpand(schema, uiSchema, formData) && (
          <Group mt="xs" justify="flex-end">
            <AddButton
              id={buttonId<T>(idSchema, "add")}
              disabled={disabled || readonly}
              onClick={onAddClick(schema)}
              className="rjsf-object-property-expand"
              uiSchema={uiSchema}
              registry={registry}
            />
          </Group>
        )}
      </Box>
    </Container>
  );
}
