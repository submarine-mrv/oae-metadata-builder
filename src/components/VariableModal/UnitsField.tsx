import { Autocomplete } from "@mantine/core";
import { getFieldMetadata, getNestedValue, type JSONSchema, setNestedValue } from "../schemaUtils";
import FieldLabel from "./FieldLabel";

interface UnitsFieldProps {
  /** Dot-separated path to the units field */
  fieldPath: string;
  /** The variable schema */
  variableSchema: JSONSchema;
  /** The root schema containing $defs */
  rootSchema: JSONSchema;
  /** Current form data */
  formData: Record<string, unknown>;
  /** Callback when value changes */
  onChange: (newFormData: Record<string, unknown>) => void;
  /** Unit strings to suggest, canonical first */
  suggestions?: string[];
  /** Show description in modal instead of tooltip */
  descriptionModal?: boolean;
  /** Placeholder when there are no suggestions */
  placeholderText?: string;
}

/**
 * Unit input backed by suggestions from the selected CF standard name.
 *
 * Mantine's Autocomplete keeps `value` as the raw string and never coerces it to a
 * member of `data`, so a typed unit lands in `units` directly. There is no `_custom`
 * sibling here, unlike EnumWithOtherField.
 */
export default function UnitsField({
  fieldPath,
  variableSchema,
  rootSchema,
  formData,
  onChange,
  suggestions = [],
  descriptionModal = false,
  placeholderText,
}: UnitsFieldProps) {
  const metadata = getFieldMetadata(fieldPath, variableSchema, rootSchema);

  if (!metadata) {
    console.warn(`UnitsField: No metadata found for path "${fieldPath}"`);
    return null;
  }

  const currentValue = getNestedValue(formData, fieldPath);
  const data = [...new Set(suggestions.filter(Boolean))];

  const handleChange = (value: string) => {
    onChange(setNestedValue(formData, fieldPath, value || undefined));
  };

  return (
    <Autocomplete
      label={
        <FieldLabel
          title={metadata.title}
          description={metadata.description}
          required={metadata.required}
          descriptionMode={descriptionModal ? "modal" : "tooltip"}
        />
      }
      data={data}
      value={typeof currentValue === "string" ? currentValue : ""}
      onChange={handleChange}
      placeholder={data.length > 0 ? `e.g., ${data[0]}` : placeholderText}
      description={
        data.length > 0
          ? "Suggested units are presented in dropdown. Any other unit can be typed"
          : undefined
      }
      // Below the input, not above it: this field sits beside long_name in a
      // two-column row, and a description above would push its input out of line.
      inputWrapperOrder={["label", "input", "description", "error"]}
      comboboxProps={{ withinPortal: true }}
      limit={20}
    />
  );
}
