"use client";

import { Box, Container, Group } from "@mantine/core";
import {
  buttonId,
  canExpand,
  descriptionId,
  getTemplate,
  getUiOptions,
  titleId
} from "@rjsf/utils";
import type {
  ObjectFieldTemplateProps,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema
} from "@rjsf/utils";

/**
 * GridObjectFieldTemplate — an ObjectFieldTemplate that uses CSS Grid
 * for precise per-field column control.
 *
 * Each property reads `"ui:span"` from its uiSchema to determine how many
 * columns it occupies (out of 12). Defaults to 6 (half width).
 *
 * Usage in uiSchema:
 * ```
 * items: {
 *   "ui:options": { ObjectFieldTemplate: GridObjectFieldTemplate },
 *   fieldA: { "ui:span": 3 },  // quarter width
 *   fieldB: { "ui:span": 6 },  // half width
 *   fieldC: { "ui:span": 12 }, // full width
 * }
 * ```
 */
export default function GridObjectFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
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
    registry
  } = props;

  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const TitleFieldTemplate = getTemplate<"TitleFieldTemplate", T, S, F>(
    "TitleFieldTemplate",
    registry,
    uiOptions
  );
  const DescriptionFieldTemplate = getTemplate<
    "DescriptionFieldTemplate",
    T,
    S,
    F
  >("DescriptionFieldTemplate", registry, uiOptions);
  const showOptionalDataControlInTitle = !readonly && !disabled;
  const {
    ButtonTemplates: { AddButton }
  } = registry.templates;

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
          optionalDataControl={
            showOptionalDataControlInTitle ? optionalDataControl : undefined
          }
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
      <Box
        mb="sm"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "16px 16px"
        }}
      >
        {!showOptionalDataControlInTitle ? optionalDataControl : undefined}
        {properties
          .filter((e) => !e.hidden)
          .map((element) => {
            const propUiSchema = uiSchema?.[element.name] || {};
            const span =
              typeof propUiSchema["ui:span"] === "number"
                ? propUiSchema["ui:span"]
                : 6;

            return (
              <Box
                key={element.name}
                style={{ gridColumn: `span ${span}` }}
              >
                {element.content}
              </Box>
            );
          })}
      </Box>
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
