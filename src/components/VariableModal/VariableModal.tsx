"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from "react";
import {
  Modal,
  Select,
  Button,
  Group,
  Stack,
  Text,
  Accordion,
  ScrollArea,
  Badge,
  Pill,
  Grid,
  Box
} from "@mantine/core";
import { IconCheck, IconCategory, IconChevronDown } from "@tabler/icons-react";
import {
  VARIABLE_TYPE_OPTIONS,
  VARIABLE_SCHEMA_MAP,
  VARIABLE_TYPE_BEHAVIOR,
  getAccordionConfig,
  getSchemaKey,
  normalizeFieldConfig,
  getPlaceholderOverride
} from "./variableModalConfig";
import {
  fieldExistsInSchema,
  isFieldRequired,
  getNestedValue,
  resolveRef,
  type JSONSchema
} from "../schemaUtils";
import SchemaField from "./SchemaField";
import EnumWithOtherField from "./EnumWithOtherField";
import OptionalWithGateField from "./OptionalWithGateField";

// Genesis (measured/calculated) options
const GENESIS_OPTIONS = [
  { value: "measured", label: "Measured directly" },
  { value: "calculated", label: "Calculated from other variables" }
];

// Sampling (discrete/continuous) options
const SAMPLING_OPTIONS = [
  { value: "discrete", label: "Discrete bottle samples" },
  { value: "continuous", label: "Continuous autonomous sensors" }
];

// Human-readable labels for pills
const VARIABLE_TYPE_LABELS: Record<string, string> = {
  pH: "pH",
  ta: "Total Alkalinity",
  dic: "DIC",
  observed_property: "Observed Property",
  sediment: "Sediment",
  co2: "CO₂",
  hplc: "HPLC",
  non_measured: "Non-Measured"
};

const GENESIS_LABELS: Record<string, string> = {
  measured: "Measured",
  calculated: "Calculated"
};

const SAMPLING_LABELS: Record<string, string> = {
  discrete: "Discrete",
  continuous: "Continuous"
};

interface VariableModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  initialData?: Record<string, unknown>;
  /** The root schema containing $defs for all variable types */
  rootSchema: JSONSchema;
}

/**
 * Schema-driven Variable Modal
 *
 * The variable type is determined by the combination of:
 * - variable_type (pH, ta, dic, observed_property, sediment, co2, hplc, non_measured)
 * - genesis (measured, calculated)
 * - sampling (discrete, continuous) - only for measured
 *
 * These selections map to a specific $defs schema, which then drives
 * which fields are shown in each accordion section.
 */
export default function VariableModal({
  opened,
  onClose,
  onSave,
  initialData,
  rootSchema
}: VariableModalProps) {
  // Form state
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [openSections, setOpenSections] = useState<string[]>(["variable-type"]);

  // Schema selection state (drives which $defs schema to use)
  const [variableType, setVariableType] = useState<string | null>(null);
  const [genesis, setGenesis] = useState<string | null>(null);
  const [sampling, setSampling] = useState<string | null>(null);

  // Track previous completion state to detect transitions (for auto-collapse)
  const wasTypeSelectionComplete = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (opened) {
      if (initialData) {
        setFormData(initialData);
        // Extract selection state from initial data
        setVariableType((initialData._variableType as string) || null);
        setGenesis((initialData.genesis as string) || null);
        setSampling((initialData.sampling as string) || null);
        // If editing, start with variable-type collapsed and basic open
        setOpenSections(["basic"]);
        // Mark as already complete so auto-collapse doesn't re-trigger
        wasTypeSelectionComplete.current = true;
      } else {
        setFormData({});
        setVariableType(null);
        setGenesis(null);
        setSampling(null);
        setOpenSections(["variable-type"]);
        // Reset so auto-collapse will trigger when selections are made
        wasTypeSelectionComplete.current = false;
      }
    }
  }, [opened, initialData]);

  // Determine which schema to use based on current selections
  const schemaKey = useMemo(() => {
    return getSchemaKey(
      variableType || undefined,
      genesis || undefined,
      sampling || undefined
    );
  }, [variableType, genesis, sampling]);

  // Filter sampling options to only those available for the selected variable type
  const availableSamplingOptions = useMemo(() => {
    if (!variableType) return SAMPLING_OPTIONS;
    const typeMap = VARIABLE_SCHEMA_MAP[variableType as keyof typeof VARIABLE_SCHEMA_MAP];
    if (!typeMap) return [];
    const measured = (typeMap as Record<string, unknown>).measured;
    if (!measured || typeof measured === "string") return [];
    return SAMPLING_OPTIONS.filter(
      (opt) => opt.value in (measured as Record<string, unknown>)
    );
  }, [variableType]);

  // Get the resolved variable schema
  const variableSchema = useMemo(() => {
    if (!schemaKey || !rootSchema.$defs) return null;
    const schema = rootSchema.$defs[schemaKey];
    if (!schema) return null;
    return resolveRef(schema, rootSchema);
  }, [schemaKey, rootSchema]);

  // Filter accordions to only show sections with visible fields
  const visibleAccordions = useMemo(() => {
    if (!schemaKey || !variableSchema) return [];

    return getAccordionConfig(schemaKey)
      .map((section) => ({
        ...section,
        visibleFields: section.fields
          .map(normalizeFieldConfig)
          .filter((field) =>
            fieldExistsInSchema(field.path, variableSchema, rootSchema)
          )
      }))
      .filter((section) => section.visibleFields.length > 0);
  }, [schemaKey, variableSchema, rootSchema]);

  // Check if variable type selection is complete
  const typeBehavior = variableType ? VARIABLE_TYPE_BEHAVIOR[variableType] : undefined;
  const isTypeSelectionComplete =
    (typeBehavior?.directSchema && !!variableType) ||
    genesis === "calculated" ||
    (genesis === "measured" && !!sampling);

  // When type selection BECOMES complete (transitions from false to true),
  // auto-collapse variable-type and open basic
  useEffect(() => {
    if (isTypeSelectionComplete && !wasTypeSelectionComplete.current) {
      // Transition from incomplete to complete - auto-open basic
      setOpenSections(["basic"]);
    }
    wasTypeSelectionComplete.current = isTypeSelectionComplete;
  }, [isTypeSelectionComplete]);

  // Handle selection changes
  const handleVariableTypeChange = (value: string | null) => {
    setVariableType(value);
    const behavior = value ? VARIABLE_TYPE_BEHAVIOR[value] : undefined;

    if (behavior?.fixedGenesis) {
      // Auto-set fixed genesis and sampling
      setGenesis(behavior.fixedGenesis);
      setSampling(behavior.fixedSampling || null);
      setFormData((prev) => ({
        ...prev,
        _variableType: value,
        genesis: behavior.fixedGenesis,
        sampling: behavior.fixedSampling || undefined
      }));
    } else {
      // Standard and directSchema: reset genesis and sampling
      setGenesis(null);
      setSampling(null);
      setFormData((prev) => ({
        ...prev,
        _variableType: value,
        genesis: undefined,
        sampling: undefined
      }));
    }
  };

  const handleGenesisChange = (value: string | null) => {
    setGenesis(value);
    // Always reset sampling when genesis changes to avoid stale values
    setSampling(null);
    setFormData((prev) => ({
      ...prev,
      genesis: value,
      sampling: undefined
    }));
  };

  const handleSamplingChange = (value: string | null) => {
    setSampling(value);
    setFormData((prev) => ({ ...prev, sampling: value }));
  };

  // Handle form data changes from SchemaField
  const handleFormChange = useCallback(
    (newFormData: Record<string, unknown>) => {
      setFormData(newFormData);
    },
    []
  );

  // Handle save
  const handleSave = () => {
    if (!schemaKey) return;
    // Include the schema key and selection state in saved data
    onSave({
      ...formData,
      _schemaKey: schemaKey,
      _variableType: variableType
    });
  };

  // Handle accordion section click - auto-collapse others unless using chevron
  const handleSectionClick = useCallback(
    (sectionKey: string, isChevronClick: boolean) => {
      if (isChevronClick) {
        // Toggle mode: add or remove this section from openSections
        setOpenSections((prev) =>
          prev.includes(sectionKey)
            ? prev.filter((s) => s !== sectionKey)
            : [...prev, sectionKey]
        );
      } else {
        // Single mode: close all others, open only this section
        setOpenSections((prev) =>
          prev.includes(sectionKey) ? [] : [sectionKey]
        );
      }
    },
    []
  );

  const isEditing = !!initialData?._variableType;

  // Calculate section progress
  const getSectionProgress = (section: (typeof visibleAccordions)[0]) => {
    if (!variableSchema) {
      return { filled: 0, total: 0, allOptional: true, complete: false };
    }

    const requiredFields = section.visibleFields.filter((field) =>
      isFieldRequired(field.path, variableSchema, rootSchema)
    );

    if (requiredFields.length === 0) {
      return { filled: 0, total: 0, allOptional: true, complete: true };
    }

    const filled = requiredFields.filter((field) => {
      const value = getNestedValue(formData, field.path);
      return value !== undefined && value !== null && value !== "";
    }).length;

    return {
      filled,
      total: requiredFields.length,
      allOptional: false,
      complete: filled === requiredFields.length
    };
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? "Edit Variable" : "Add Variable"}
      size="xl"
      centered
    >
      <ScrollArea h={550} offsetScrollbars>
        <Accordion
          multiple
          value={openSections}
          variant="separated"
          chevron={null}
        >
          {/* Variable Type Selection - Special accordion */}
          <Accordion.Item value="variable-type">
            <Accordion.Control icon={<IconCategory size={18} />}>
              <AccordionControlContent
                sectionKey="variable-type"
                label="Variable Type"
                isOpen={openSections.includes("variable-type")}
                onSectionClick={handleSectionClick}
                collapsedContent={
                  (variableType || genesis || sampling) && (
                    <Group gap={4} ml="xs">
                      {variableType && (
                        <Pill size="sm">
                          {VARIABLE_TYPE_LABELS[variableType] || variableType}
                        </Pill>
                      )}
                      {genesis && (
                        <Pill size="sm">
                          {GENESIS_LABELS[genesis] || genesis}
                        </Pill>
                      )}
                      {sampling && (
                        <Pill size="sm">
                          {SAMPLING_LABELS[sampling] || sampling}
                        </Pill>
                      )}
                    </Group>
                  )
                }
              />
            </Accordion.Control>
            <Accordion.Panel
              key={`variable-type-${variableType || "none"}-${genesis || "none"}`}
            >
              <Stack gap="sm">
                {/* Variable Type Selector */}
                <Select
                  label="What is the variable type?"
                  placeholder="Select variable type"
                  data={VARIABLE_TYPE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label
                  }))}
                  value={variableType}
                  onChange={handleVariableTypeChange}
                  required
                />

                {/* Genesis Selector - appears after variable type selected, hidden for direct/fixed types */}
                {variableType && !typeBehavior?.directSchema && !typeBehavior?.fixedGenesis && (
                  <Select
                    label="Was this variable measured directly or calculated?"
                    placeholder="Select measurement method"
                    data={GENESIS_OPTIONS}
                    value={genesis}
                    onChange={handleGenesisChange}
                    required
                  />
                )}

                {/* Sampling Selector - Only for measured, hidden for direct/fixed types */}
                {genesis === "measured" && !typeBehavior?.directSchema && !typeBehavior?.fixedSampling && (
                  <Select
                    label="Were the measurements taken from discrete bottles or continuous sensors?"
                    placeholder="Select measurement type"
                    data={availableSamplingOptions}
                    value={sampling}
                    onChange={handleSamplingChange}
                    required
                  />
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Dynamic accordion sections - only shown when schema is determined */}
          {variableSchema &&
            isTypeSelectionComplete &&
            visibleAccordions.map((section) => {
              const progress = getSectionProgress(section);
              const Icon = section.icon;

              return (
                <Accordion.Item key={section.key} value={section.key}>
                  <Accordion.Control icon={<Icon size={18} />}>
                    <AccordionControlContent
                      sectionKey={section.key}
                      label={section.label}
                      isOpen={openSections.includes(section.key)}
                      onSectionClick={handleSectionClick}
                      collapsedContent={<ProgressBadge {...progress} />}
                    />
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Grid gutter="sm">
                      {section.visibleFields.flatMap((field): React.ReactElement[] => {
                        // Compute effective placeholder with override support
                        const effectivePlaceholder =
                          getPlaceholderOverride(variableType || undefined, field.path) ||
                          field.placeholderText;

                        // Helper to add row spacer if needed
                        const maybeAddSpacer = (elements: React.ReactElement[]): React.ReactElement[] => {
                          if (field.newRowAfter && field.span && field.span < 12) {
                            elements.push(
                              <Grid.Col key={`${field.path}-spacer`} span={12 - field.span} />
                            );
                          }
                          return elements;
                        };

                        if (field.inputType === "enum_with_other") {
                          return [
                            <EnumWithOtherField
                              key={field.path}
                              fieldPath={field.path}
                              variableSchema={variableSchema}
                              rootSchema={rootSchema}
                              formData={formData}
                              onChange={handleFormChange}
                              descriptionModal={field.descriptionModal}
                              placeholderText={effectivePlaceholder}
                            />
                          ];
                        }

                        if (field.inputType === "optional_with_gate") {
                          return [
                            <OptionalWithGateField
                              key={field.path}
                              fieldPath={field.path}
                              variableSchema={variableSchema}
                              rootSchema={rootSchema}
                              formData={formData}
                              onChange={handleFormChange}
                              descriptionModal={field.descriptionModal}
                              placeholderText={effectivePlaceholder}
                              gateLabel={field.gateLabel || "Include this field?"}
                            />
                          ];
                        }

                        return maybeAddSpacer([
                          <Grid.Col key={field.path} span={field.span}>
                            <SchemaField
                              fieldPath={field.path}
                              variableSchema={variableSchema}
                              rootSchema={rootSchema}
                              formData={formData}
                              onChange={handleFormChange}
                              inputType={field.inputType}
                              descriptionMode={
                                field.descriptionModal ? "modal" : "tooltip"
                              }
                              placeholderText={effectivePlaceholder}
                              rows={field.rows}
                            />
                          </Grid.Col>
                        ]);
                      })}
                    </Grid>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
        </Accordion>
      </ScrollArea>

      <Group justify="flex-end" gap="sm" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!schemaKey || !formData.long_name || !formData.dataset_variable_name}
        >
          {isEditing ? "Update Variable" : "Add Variable"}
        </Button>
      </Group>
    </Modal>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

interface AccordionControlContentProps {
  sectionKey: string;
  label: string;
  isOpen: boolean;
  onSectionClick: (sectionKey: string, isChevronClick: boolean) => void;
  collapsedContent?: React.ReactNode;
}

/**
 * Reusable accordion control content with click handling.
 * - Clicking the title auto-collapses other sections (single mode)
 * - Clicking the chevron toggles without affecting others (toggle mode)
 */
function AccordionControlContent({
  sectionKey,
  label,
  isOpen,
  onSectionClick,
  collapsedContent
}: AccordionControlContentProps) {
  return (
    <Box
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSectionClick(sectionKey, false);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        cursor: "pointer"
      }}
    >
      <Text fw={500} style={{ flex: 1 }}>{label}</Text>
      {!isOpen && collapsedContent}
      <Box
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSectionClick(sectionKey, true);
        }}
        style={{
          marginLeft: "0.5rem",
          padding: "4px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center"
        }}
      >
        <IconChevronDown
          size={18}
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease"
          }}
        />
      </Box>
    </Box>
  );
}



interface ProgressBadgeProps {
  filled: number;
  total: number;
  allOptional: boolean;
  complete: boolean;
}

function ProgressBadge({
  filled,
  total,
  allOptional,
  complete
}: ProgressBadgeProps) {
  if (allOptional) {
    return (
      <Badge variant="light" color="gray" size="sm">
        Optional
      </Badge>
    );
  }

  if (complete) {
    return (
      <Badge
        variant="light"
        color="green"
        size="sm"
        leftSection={<IconCheck size={12} />}
      >
        Complete
      </Badge>
    );
  }

  if (filled === 0) {
    return (
      <Badge variant="light" color="orange" size="sm">
        {total} required
      </Badge>
    );
  }

  return (
    <Badge variant="light" color="blue" size="sm">
      {filled} of {total}
    </Badge>
  );
}

